// POST /api/pipeline/generate — proxy to the FastAPI /generate endpoint.
//
// Phase 8A activation gate. Triggers the 6-stage content pipeline for one
// (topic_id, tier) pair. Generated questions are written by the pipeline
// service directly to Supabase with status determined by the confidence
// score (CLAUDE.md §8). This route only orchestrates and logs.

import { NextResponse } from 'next/server'
import {
  authoriseAdminRequest,
  logProxyEvent,
  proxyPipeline,
} from '@/lib/admin/pipeline'

const TIERS = ['sprout', 'explorer', 'lightning'] as const
type Tier = (typeof TIERS)[number]

type GenerateRequestBody = {
  topic_id?: unknown
  tier?: unknown
  count?: unknown
}

type ValidatedRequest = { topic_id: string; tier: Tier; count: number }

function validate(body: GenerateRequestBody): ValidatedRequest | string {
  if (typeof body.topic_id !== 'string' || body.topic_id.length < 8) {
    return 'topic_id is required'
  }
  if (typeof body.tier !== 'string' || !TIERS.includes(body.tier as Tier)) {
    return `tier must be one of ${TIERS.join(' | ')}`
  }
  const count = typeof body.count === 'number' ? body.count : 5
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    // Cost ceiling: Phase 8A caps a single request at 10 questions to prevent
    // accidental bulk-generation through the admin trigger. Bulk runs must be
    // a deliberate later phase.
    return 'count must be an integer between 1 and 10'
  }
  return { topic_id: body.topic_id, tier: body.tier as Tier, count }
}

type UpstreamGenerate = {
  topic_id: string
  tier: string
  published: number
  staged: number
  regenerating: number
  failed: number
  input_tokens: number
  output_tokens: number
  model: string
  results: Array<{
    question_id: string | null
    status: string
    confidence_score: number
    stage_log: string[]
    input_tokens: number
    output_tokens: number
  }>
}

export async function POST(request: Request) {
  const auth = await authoriseAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }

  let raw: GenerateRequestBody
  try {
    raw = (await request.json()) as GenerateRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const validated = validate(raw)
  if (typeof validated === 'string') {
    return NextResponse.json({ error: validated }, { status: 400 })
  }

  const started = Date.now()
  const result = await proxyPipeline<UpstreamGenerate>('/generate', {
    method: 'POST',
    body: validated,
    timeoutMs: 5 * 60_000,
  })

  const elapsed_ms = Date.now() - started
  const upstream = result.status === 200 ? (result.body as UpstreamGenerate) : null

  logProxyEvent({
    route: '/api/pipeline/generate',
    via: auth.via,
    upstream_status: result.status,
    topic_id: validated.topic_id,
    tier: validated.tier,
    count_requested: validated.count,
    count_published: upstream?.published ?? null,
    count_staged: upstream?.staged ?? null,
    count_regenerating: upstream?.regenerating ?? null,
    count_failed: upstream?.failed ?? null,
    input_tokens: upstream?.input_tokens ?? null,
    output_tokens: upstream?.output_tokens ?? null,
    model: upstream?.model ?? null,
    elapsed_ms,
  })

  return NextResponse.json(result.body, { status: result.status })
}
