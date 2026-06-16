import 'server-only'
import { createHash } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Server-side narration TTS for the Explore tab.
//
// Why this exists: the explorers used to narrate via the browser Web Speech
// API (`speechSynthesis`), which picks whatever voice is installed on each
// device. That made the same narration sound like a warm lady on one phone and
// a robotic man on another. We now synthesise the audio ONCE on the server with
// a single fixed voice and cache the result in Supabase Storage, so every
// device hears the identical voice (iOS included).
//
// Generator: the Piper TTS engine running in the content-pipeline service
// (PIPELINE_SERVICE_URL/tts). Offline, CPU-only, no API key, no per-use cost —
// it only runs on a cache miss. Voice: en_GB-jenny_dioco-medium (UK female).
//
// Caching: each unique narration string is generated at most once. The object
// key is a content hash of (voice + format + text), so identical text is always
// a cache hit and Piper only runs the first time a snippet is requested.
// ---------------------------------------------------------------------------

// Identifies the generator+voice in the cache key. Bump this (or change the
// pipeline's PIPER_VOICE) to re-generate cleanly under a new object path; old
// files are simply orphaned, never served.
export const TTS_VOICE = 'piper:en_GB-jenny_dioco-medium'
export const TTS_FORMAT = 'wav'

export const TTS_BUCKET = 'explore-tts'
const MAX_INPUT_CHARS = 2000

/** Collapse whitespace and trim so trivially-different text still cache-hits. */
export function normalizeNarration(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_CHARS)
}

/** Storage object path for a given narration string. Sharded by the first two
 *  hash chars to avoid an ever-growing flat folder. */
export function narrationObjectPath(normalized: string): string {
  const hash = createHash('sha256')
    .update(`${TTS_VOICE} ${TTS_FORMAT} ${normalized}`)
    .digest('hex')
  return `${hash.slice(0, 2)}/${hash}.${TTS_FORMAT}`
}

function publicUrl(objectPath: string): string {
  const admin = createSupabaseAdminClient()
  return admin.storage.from(TTS_BUCKET).getPublicUrl(objectPath).data.publicUrl
}

async function objectExists(objectPath: string): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const slash = objectPath.lastIndexOf('/')
  const folder = objectPath.slice(0, slash)
  const file = objectPath.slice(slash + 1)
  const { data, error } = await admin.storage.from(TTS_BUCKET).list(folder, { search: file, limit: 1 })
  if (error) return false
  return (data ?? []).some((o) => o.name === file)
}

// Synthesise via the content-pipeline service's Piper endpoint. Server-only —
// PIPELINE_SERVICE_URL is never exposed to the client (CLAUDE.md §16 rule 3).
async function synthesizeViaPipeline(input: string): Promise<ArrayBuffer> {
  const base = process.env.PIPELINE_SERVICE_URL?.trim()
  if (!base) throw new Error('PIPELINE_SERVICE_URL is not set')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'audio/wav' },
      body: JSON.stringify({ text: input }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`Pipeline TTS error: ${res.status} ${(await res.text()).slice(0, 200)}`)
    }
    return res.arrayBuffer()
  } finally {
    clearTimeout(timer)
  }
}

export interface NarrationAudio {
  url: string
  cached: boolean
}

/**
 * Return a public URL to the narration audio, generating + caching it on a
 * miss. Safe to call concurrently for the same text: a duplicate generation
 * just upserts the same object (idempotent), costing at most one extra run.
 */
export async function ensureNarrationAudio(rawText: string): Promise<NarrationAudio | null> {
  const normalized = normalizeNarration(rawText)
  if (!normalized) return null

  const objectPath = narrationObjectPath(normalized)

  if (await objectExists(objectPath)) {
    return { url: publicUrl(objectPath), cached: true }
  }

  const audio = await synthesizeViaPipeline(normalized)
  const admin = createSupabaseAdminClient()
  const { error } = await admin.storage
    .from(TTS_BUCKET)
    .upload(objectPath, Buffer.from(audio), {
      contentType: 'audio/wav',
      cacheControl: '31536000', // immutable — keyed by content hash
      upsert: true,
    })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  return { url: publicUrl(objectPath), cached: false }
}
