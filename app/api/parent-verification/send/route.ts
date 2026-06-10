// POST /api/parent-verification/send  { userId }
// Fires the initial parent/guardian verification email right after a child
// self-registers. Public route (the child may have no session yet when email
// confirmation is enabled), so it is deliberately unhelpful to probers:
// it always returns { ok: true } and is throttled to one email per 24 h.
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendParentVerificationEmail } from '@/lib/parent-verification'

const RESEND_THROTTLE_MS = 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { userId?: unknown }
  const userId = typeof body.userId === 'string' ? body.userId : null
  if (!userId) return NextResponse.json({ ok: true })

  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
    select: {
      id: true,
      role: true,
      display_name: true,
      parent_email: true,
      parent_email_verified_at: true,
      parent_verify_token: true,
      parent_verify_sent_at: true,
    },
  })

  if (
    !profile ||
    profile.role !== 'child' ||
    !profile.parent_email ||
    profile.parent_email_verified_at
  ) {
    return NextResponse.json({ ok: true })
  }
  if (
    profile.parent_verify_sent_at &&
    Date.now() - profile.parent_verify_sent_at.getTime() < RESEND_THROTTLE_MS
  ) {
    return NextResponse.json({ ok: true })
  }

  let token = profile.parent_verify_token
  if (!token) {
    token = randomUUID()
    await prisma.profile.update({
      where: { id: profile.id },
      data: { parent_verify_token: token },
    })
  }

  try {
    await sendParentVerificationEmail({
      to: profile.parent_email,
      childName: profile.display_name,
      token,
      kind: 'initial',
    })
    await prisma.profile.update({
      where: { id: profile.id },
      data: { parent_verify_sent_at: new Date() },
    })
  } catch (err) {
    // Best-effort: the daily cron retries anything that never got an email.
    console.error('parent-verification/send failed:', err)
  }

  return NextResponse.json({ ok: true })
}
