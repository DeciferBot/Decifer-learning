// POST /api/pipeline/regenerate-flagged — Phase 12.
// Admin-only proxy to the pipeline service's /pipeline/regenerate-flagged endpoint.
// Picks up flagged questions and re-runs them through the 6-stage pipeline.
// Can be triggered from the admin monitoring page or via a scheduled cron.

import { NextResponse } from 'next/server'
import {
  authoriseAdminRequest,
  logProxyEvent,
  proxyPipeline,
} from '@/lib/admin/pipeline'

type RegenerateFlaggedBody = {
  limit?: unknown
}

type UpstreamResponse = {
  triggered: number
  results: Array<{
    question_id: string
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

  let body: RegenerateFlaggedBody = {}
  try {
    body = (await request.json()) as RegenerateFlaggedBody
  } catch {
    // empty body is fine — limit defaults to 20 in the pipeline service
  }

  const limit = typeof body.limit === 'number' && Number.isInteger(body.limit)
    ? Math.min(Math.max(body.limit, 1), 50)
    : 20

  const started = Date.now()
  const result = await proxyPipeline<UpstreamResponse>(
    `/pipeline/regenerate-flagged?limit=${limit}`,
    {
      method: 'POST',
      body:   {},
      timeoutMs: 10 * 60_000, // regeneration can take a while
    },
  )

  const elapsed_ms = Date.now() - started
  const upstream = result.status === 200 ? (result.body as UpstreamResponse) : null

  logProxyEvent({
    route:            '/api/pipeline/regenerate-flagged',
    via:              auth.via,
    upstream_status:  result.status,
    count_published:  upstream?.results.filter((r) => r.status === 'published').length ?? null,
    count_staged:     upstream?.results.filter((r) => r.status === 'staged').length ?? null,
    count_failed:     upstream?.results.filter((r) => r.status === 'failed').length ?? null,
    elapsed_ms,
  })

  return NextResponse.json(result.body, { status: result.status })
}
