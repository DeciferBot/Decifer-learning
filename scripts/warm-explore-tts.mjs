// Warm the Explore narration TTS cache.
//
// Walks explorer_nodes narration, synthesises each unique string via the
// pipeline's Piper /tts endpoint, and uploads the WAV to the Supabase Storage
// `explore-tts` bucket — so children never wait on first play. Idempotent:
// already-cached strings are skipped. Lazy generation in /api/explore/tts
// covers anything this misses, so a hash mismatch only costs a redundant file.
//
// MUST stay in sync with lib/explore/tts.ts (TTS_VOICE, TTS_FORMAT, normalize,
// object path) and with the /pregenerate route's string extraction.
//
// NOTE: `vercel env pull` returns EMPTY for sensitive vars (service-role key,
// etc. are encrypted/write-only in Vercel), so it cannot supply the key here.
// Get SUPABASE_SERVICE_ROLE_KEY from the Supabase dashboard (Project Settings →
// API) and run:
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
//   PIPELINE_SERVICE_URL=https://pipeline.deciferlearning.com \
//   node scripts/warm-explore-tts.mjs
//
// Easier alternative (no key handling): while logged in as an admin, POST to
//   /api/explore/tts/pregenerate   (does the same walk + warm inside the app).

import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const TTS_VOICE = 'piper:en_GB-jenny_dioco-medium'
const TTS_FORMAT = 'wav'
const BUCKET = 'explore-tts'
const MAX_INPUT_CHARS = 2000

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, PIPELINE_SERVICE_URL: PIPELINE_URL })) {
  if (!v) { console.error(`Missing ${k}. Did you pull the production env?`); process.exit(1) }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const normalize = (t) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_CHARS)

function objectPath(normalized) {
  const hash = createHash('sha256').update(`${TTS_VOICE} ${TTS_FORMAT} ${normalized}`).digest('hex')
  return `${hash.slice(0, 2)}/${hash}.${TTS_FORMAT}`
}

// Mirror the /pregenerate route's narrationStrings(): the exact strings each
// explorer module passes to <NarrationButton>.
function narrationStrings(content) {
  const out = []
  if (content?.narration) out.push(content.narration)
  for (const layer of content?.layers ?? []) if (layer?.narration) out.push(layer.narration)
  if (content?.kidFact && content?.summary) out.push(`${content.kidFact} ${content.summary}`)
  else if (content?.summary) out.push(content.summary)
  return out
}

async function exists(path) {
  const slash = path.lastIndexOf('/')
  const { data, error } = await supabase.storage.from(BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 })
  if (error) return false
  return (data ?? []).some((o) => o.name === path.slice(slash + 1))
}

async function synth(text) {
  const res = await fetch(`${PIPELINE_URL.replace(/\/$/, '')}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'audio/wav' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 120)}`)
  return Buffer.from(await res.arrayBuffer())
}

const { data: nodes, error } = await supabase.from('explorer_nodes').select('content')
if (error) { console.error('DB error:', error.message); process.exit(1) }

const unique = new Set()
for (const n of nodes ?? []) for (const s of narrationStrings(n.content ?? {})) {
  const t = (s ?? '').trim()
  if (t) unique.add(t)
}

console.log(`${nodes?.length ?? 0} nodes → ${unique.size} unique narration strings`)
let generated = 0, cached = 0, failed = 0, i = 0
for (const text of unique) {
  i++
  const norm = normalize(text)
  const path = objectPath(norm)
  try {
    if (await exists(path)) { cached++; continue }
    const wav = await synth(norm)
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, wav, { contentType: 'audio/wav', cacheControl: '31536000', upsert: true })
    if (upErr) throw upErr
    generated++
    if (generated % 10 === 0) console.log(`  ${i}/${unique.size} — ${generated} generated, ${cached} cached`)
  } catch (e) {
    failed++
    console.warn(`  ✗ "${text.slice(0, 50)}…": ${e.message}`)
  }
}

console.log(`\nDone: ${generated} generated, ${cached} already cached, ${failed} failed (total ${unique.size})`)
