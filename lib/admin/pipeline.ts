// Server-only helpers for the Phase 8A content-pipeline proxy.
//
// Purpose:
//   - Centralise the PIPELINE_SERVICE_URL env-var read so client code can
//     never accidentally import it.
//   - Provide a single auth gate used by every /api/pipeline/* route.
//   - Provide a single proxy helper that adds structured logging.
//
// CLAUDE.md §5 (Railway hosts the pipeline microservice), §6 (env var name),
// §16 rules 3, 4, 8.

import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'

export type AdminAuthResult =
  | { ok: true; via: 'admin-role' | 'admin-token' }
  | { ok: false; status: 401 | 403; reason: string }

/**
 * Authorise an incoming request against /api/pipeline/*.
 *
 * Accepts either:
 *   - a signed-in user whose profile.role = 'admin', OR
 *   - a valid `x-admin-token` header matching ADMIN_PIPELINE_TOKEN (for curl/CI use).
 */
export async function authoriseAdminRequest(
  request: Request,
): Promise<AdminAuthResult> {
  const headerToken = request.headers.get('x-admin-token')?.trim()
  const expected = process.env.ADMIN_PIPELINE_TOKEN?.trim()
  if (expected && headerToken && headerToken === expected) {
    return { ok: true, via: 'admin-token' }
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, reason: 'not signed in' }
  }
  const profile = await getCurrentProfile(supabase, user.id)
  if (profile?.role === 'admin') {
    return { ok: true, via: 'admin-role' }
  }
  return { ok: false, status: 403, reason: 'admin role required' }
}

export type PipelineProxyError = {
  status: number
  body: { error: string; detail?: unknown }
}

export type PipelineProxySuccess<T> = {
  status: number
  body: T
}

/**
 * Proxy an upstream call to the pipeline service. Fails closed (503) if
 * PIPELINE_SERVICE_URL is not configured. Never throws — callers can pass
 * the returned status + body straight through to NextResponse.json.
 */
export async function proxyPipeline<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs?: number },
): Promise<PipelineProxySuccess<T> | PipelineProxyError> {
  const base = process.env.PIPELINE_SERVICE_URL?.trim()
  if (!base) {
    return {
      status: 503,
      body: {
        error:
          'PIPELINE_SERVICE_URL is not configured. Set it in Vercel env vars to the Railway URL.',
      },
    }
  }

  const url = `${base.replace(/\/$/, '')}${path}`
  const timeoutMs = init.timeoutMs ?? 120_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const upstream = await fetch(url, {
      method: init.method,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })
    const text = await upstream.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { error: 'upstream returned non-JSON', raw: text.slice(0, 500) }
    }
    if (!upstream.ok) {
      return {
        status: upstream.status,
        body: { error: 'upstream pipeline error', detail: parsed },
      }
    }
    return { status: 200, body: parsed as T }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return {
      status: 504,
      body: { error: 'pipeline request failed', detail: reason },
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Emit a single structured JSON line for every proxied generate request.
 * Vercel and Railway both ingest stdout into their log aggregators; this
 * acts as the lightweight cost/safety tripwire required by Phase 8A.
 */
export function logProxyEvent(payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      event: 'pipeline.proxy',
      ts: new Date().toISOString(),
      ...payload,
    }),
  )
}
