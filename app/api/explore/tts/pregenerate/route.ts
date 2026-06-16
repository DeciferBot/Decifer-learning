// POST /api/explore/tts/pregenerate
// Admin-only: walk every explorer node's narration and warm the TTS cache so
// children never wait on first play. Idempotent — already-cached snippets are
// skipped. Lazy generation in /api/explore/tts covers anything not pre-warmed,
// so this is a latency optimisation, not a correctness requirement.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import { ensureNarrationAudio } from '@/lib/explore/tts'

interface NodeContent {
  narration?: string
  summary?: string
  kidFact?: string
  layers?: { narration?: string }[]
}

// Mirror the exact strings each explorer module hands to <NarrationButton>, so
// the warmed cache keys match the runtime requests.
function narrationStrings(content: NodeContent): string[] {
  const out: string[] = []
  if (content.narration) out.push(content.narration)
  for (const layer of content.layers ?? []) {
    if (layer?.narration) out.push(layer.narration)
  }
  if (content.kidFact && content.summary) out.push(`${content.kidFact} ${content.summary}`)
  else if (content.summary) out.push(content.summary)
  return out
}

export async function POST() {
  const denied = await requireAdminApi()
  if (denied) return denied

  const nodes = await prisma.explorerNode.findMany({ select: { content: true } })

  const unique = new Set<string>()
  for (const n of nodes) {
    for (const s of narrationStrings((n.content ?? {}) as NodeContent)) {
      const trimmed = s.trim()
      if (trimmed) unique.add(trimmed)
    }
  }

  let generated = 0
  let cached = 0
  let failed = 0
  // Sequential to stay polite to the OpenAI rate limit and keep memory flat.
  for (const text of unique) {
    try {
      const res = await ensureNarrationAudio(text)
      if (res?.cached) cached++
      else if (res) generated++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ total: unique.size, generated, cached, failed })
}
