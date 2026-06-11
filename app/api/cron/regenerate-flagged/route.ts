// POST /api/cron/regenerate-flagged
// Vercel Cron — runs nightly at 03:00 UTC (one hour after anomaly-detect).
// Fires the pipeline's /pipeline/regenerate-flagged-all background drain
// (up to 150 questions/night) — not bounded by the serverless timeout.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

async function handler(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipelineUrl = process.env.PIPELINE_SERVICE_URL
  if (!pipelineUrl) {
    console.error('[regenerate-flagged] PIPELINE_SERVICE_URL not set')
    return NextResponse.json({ error: 'PIPELINE_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${pipelineUrl.replace(/\/$/, '')}/pipeline/regenerate-flagged-all?cap=150`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(30_000), // returns immediately — the drain runs as a pipeline background task
    })
    const body = await res.json()
    console.log('[regenerate-flagged] pipeline response', body)
    return NextResponse.json(body)
  } catch (err) {
    console.error('[regenerate-flagged] pipeline error', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

export const GET = handler
export const POST = handler
