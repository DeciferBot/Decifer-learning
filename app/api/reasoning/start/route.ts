import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { startAttempt } from '@/lib/reasoning/server'
import { isAgeBand } from '@/lib/reasoning/plan'

// POST /api/reasoning/start  { ageBand }
//
// Public and unauthenticated on purpose: a parent can hand a child a tablet
// without making an account first.
//
// Returns the FIRST question only. The test is adaptive, so question N+1 does
// not exist until answer N is known — see lib/reasoning/server.ts. Nothing in
// the payload says which option is right; marking happens in /answer.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  // Generous: a family sharing one connection may legitimately start several.
  if (!rateLimit(`reasoning-start:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: { ageBand?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // The band is optional and changes nothing about the test. An unrecognised
  // value falls back rather than failing, because refusing to start a free test
  // over a field that does not affect it would be silly.
  const ageBand = isAgeBand(body.ageBand) ? body.ageBand : 'not_said'

  const started = await startAttempt(ageBand)
  return NextResponse.json({ token: started.token, question: started.question })
}
