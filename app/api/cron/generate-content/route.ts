// POST /api/cron/generate-content
// Vercel Cron — runs nightly at 01:00 UTC.
// Fires the autopilot daily run at the pipeline service (fire-and-forget).
// The pipeline rebuilds the work queue then drains it, topping up thin topics
// across all year groups and subjects.

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

  // Fire and forget — autopilot can run for up to an hour; we just kick it off.
  fetch(`${pipelineUrl.replace(/\/$/, '')}/pipeline/autopilot-daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(err => console.error('[generate-content] fire-and-forget error', err))

  console.log('[generate-content] fired autopilot-daily at pipeline')
  return NextResponse.json({ triggered: true, pipeline: pipelineUrl })
}

export const GET = handler
export const POST = handler
