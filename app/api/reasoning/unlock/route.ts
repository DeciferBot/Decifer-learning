import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { unlockReport, isValidEmail } from '@/lib/reasoning/server'
import { sendReasoningReport } from '@/lib/reasoning/email'

// POST /api/reasoning/unlock  { token, email }
//
// The email gate. Records the parent's email against the attempt, returns the
// full report, and emails a copy.
//
// The report is returned here rather than only emailed, because a parent who
// mistypes their address must still get what they asked for. The email is the
// copy, not the delivery mechanism.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  // Tighter than the rest: this is the endpoint that stores an address and sends
  // mail, so it is the one worth abusing.
  if (!rateLimit(`reasoning-unlock:${ip}`, 8, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: { token?: string; email?: string; source?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const token = body.token?.trim()
  const email = body.email?.trim()

  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 })
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  // Per-token cap on top of the per-IP one. The IP limit alone does not stop a
  // distributed replay of one finished token against many addresses, and this is
  // the endpoint that makes us send mail. Learned on the Skills Check, where the
  // same hole existed (.claude/reviews/skills-check-review.md, finding 2).
  if (!rateLimit(`reasoning-unlock-token:${token}`, 3, 3_600_000)) {
    return NextResponse.json(
      { error: 'This result has already been sent a few times. Please use the link in your email.' },
      { status: 429 },
    )
  }

  const unlocked = await unlockReport(token, email, body.source)
  if (!unlocked) return NextResponse.json({ error: 'Unknown test.' }, { status: 404 })
  const { view, shouldSend } = unlocked

  // AWAITED, not fire-and-forget.
  //
  // On Vercel the function is frozen the moment it returns a response, so
  // `void sendReasoningReport(...)` would never run to completion and the email
  // would never leave. That exact bug shipped on the Skills Check and was only
  // caught by looking in Resend rather than trusting the 200
  // (.claude/reviews/skills-check-review.md, finding 3).
  //
  // sendReasoningReport swallows its own errors, so awaiting can add latency but
  // can never turn a working unlock into a failed one. Skipped when this address
  // already has this report, so a reload does not send a second copy.
  if (shouldSend) await sendReasoningReport(view, email)

  return NextResponse.json({ token: view.token, teaser: view.teaser, report: view.report })
}
