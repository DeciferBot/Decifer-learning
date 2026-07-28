// POST /api/cron/oak-refresh
// Vercel Cron — runs daily at 04:00 UTC.
// Fires the Oak daily update at the pipeline service.
// The call is awaited: the pipeline queues the job as a background task and
// answers straight away, and an unawaited fetch dies with the function.
// The pipeline handles: fetch new Oak lessons → embed → dedupe → generate for thin topics.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

async function handler(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipelineUrl = process.env.PIPELINE_SERVICE_URL
  if (!pipelineUrl) {
    return NextResponse.json({ error: 'PIPELINE_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${pipelineUrl.replace(/\/$/, '')}/pipeline/oak-daily-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(30_000), // returns immediately — Oak ingestion runs as a pipeline background task
    })
    const body = await res.json()
    console.log('[oak-refresh] pipeline response', body)
    return NextResponse.json(body)
  } catch (err) {
    console.error('[oak-refresh] pipeline error', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

export const GET = handler
export const POST = handler
