// POST /api/cron/generate-content
// Vercel Cron — runs nightly at 01:00 UTC.
// Fires the autopilot daily run at the pipeline service.
// The call is awaited: the pipeline queues the run as a background task and
// answers straight away, and an unawaited fetch dies with the function.
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

  try {
    const res = await fetch(`${pipelineUrl.replace(/\/$/, '')}/pipeline/autopilot-daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(30_000), // returns immediately — the autopilot run happens as a pipeline background task
    })
    const body = await res.json()
    console.log('[generate-content] pipeline response', body)
    return NextResponse.json(body)
  } catch (err) {
    console.error('[generate-content] pipeline error', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

export const GET = handler
export const POST = handler
