// GET /api/pipeline/health — proxy to the FastAPI /health endpoint.
//
// Phase 8A activation gate. Server-only; never expose PIPELINE_SERVICE_URL
// or upstream details to the browser without admin auth.

import { NextResponse } from 'next/server'
import {
  authoriseAdminRequest,
  logProxyEvent,
  proxyPipeline,
} from '@/lib/admin/pipeline'

type UpstreamHealth = { status: string; version?: string }

export async function GET(request: Request) {
  const auth = await authoriseAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }

  const result = await proxyPipeline<UpstreamHealth>('/health', {
    method: 'GET',
    timeoutMs: 10_000,
  })

  logProxyEvent({
    route: '/api/pipeline/health',
    via: auth.via,
    upstream_status: result.status,
  })

  return NextResponse.json(result.body, { status: result.status })
}
