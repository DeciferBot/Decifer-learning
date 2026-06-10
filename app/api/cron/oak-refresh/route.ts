// POST /api/cron/oak-refresh
// Vercel Cron — runs daily at 04:00 UTC.
// Fires the Oak daily update at the pipeline service (fire-and-forget).
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

  // Fire and forget — Oak ingestion takes many minutes; we just kick it off.
  // The pipeline runs the full job in the background.
  fetch(`${pipelineUrl.replace(/\/$/, '')}/pipeline/oak-daily-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(err => console.error('[oak-refresh] fire-and-forget error', err))

  console.log('[oak-refresh] fired oak-daily-update at pipeline')
  return NextResponse.json({ triggered: true, pipeline: pipelineUrl })
}

export const GET = handler
export const POST = handler
