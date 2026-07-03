// POST /api/cron/fix-staged-all
// Vercel Cron — runs nightly at 03:30 UTC (between regenerate-flagged and oak-refresh).
// Fires the pipeline's /pipeline/fix-staged-all background drain (LLM polish +
// code-verified renderability/distractor gates, cap=200/night) so questions parked
// in 'staged' — including originals superseded by regenerate-flagged — are
// continuously re-evaluated against their type's confidence threshold instead of
// accumulating forever. This is gated re-scoring, not human moderation (CLAUDE.md §4/§8).

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

async function handler(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipelineUrl = process.env.PIPELINE_SERVICE_URL
  if (!pipelineUrl) {
    console.error('[fix-staged-all] PIPELINE_SERVICE_URL not set')
    return NextResponse.json({ error: 'PIPELINE_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${pipelineUrl.replace(/\/$/, '')}/pipeline/fix-staged-all?cap=200`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(30_000), // returns immediately — the drain runs as a pipeline background task
    })
    const body = await res.json()
    console.log('[fix-staged-all] pipeline response', body)
    return NextResponse.json(body)
  } catch (err) {
    console.error('[fix-staged-all] pipeline error', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

export const GET = handler
export const POST = handler
