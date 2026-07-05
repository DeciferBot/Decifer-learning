// POST /api/parent-verification/set-email  { parentEmail }
// Lets an authenticated child add or correct their parent/guardian email —
// needed for accounts that pre-date the parent-email signup field, or when
// the address was mistyped. Only works while unverified. Mints a fresh token
// and sends the verification email immediately.
//
// Anti-abuse: refused while a verification email went out in the last 24 h,
// so a child can't use repeated address changes to spam arbitrary inboxes.

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { sendParentVerificationEmail } from '@/lib/parent-verification'

const CHANGE_THROTTLE_MS = 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: {
      id: true,
      role: true,
      display_name: true,
      parent_email_verified_at: true,
      parent_verify_sent_at: true,
    },
  })
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile.parent_email_verified_at) {
    return NextResponse.json(
      { error: 'This account is already confirmed', code: 'ALREADY_VERIFIED' },
      { status: 409 },
    )
  }
  if (
    profile.parent_verify_sent_at &&
    Date.now() - profile.parent_verify_sent_at.getTime() < CHANGE_THROTTLE_MS
  ) {
    return NextResponse.json(
      {
        error: 'We emailed your parent or guardian recently, so please wait a day before changing the address.',
        code: 'CHANGE_THROTTLED',
      },
      { status: 429 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as { parentEmail?: unknown }
  const parentEmail =
    typeof body.parentEmail === 'string' ? body.parentEmail.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
    return NextResponse.json(
      { error: 'Enter a valid email address', code: 'INVALID_EMAIL' },
      { status: 422 },
    )
  }
  if (user.email && parentEmail === user.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'Your parent or guardian’s email must be different from your own', code: 'SAME_AS_CHILD' },
      { status: 422 },
    )
  }

  const token = randomUUID()
  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      parent_email: parentEmail,
      parent_verify_token: token,
      parent_verify_sent_at: null,
      parent_verify_reminder_count: 0,
    },
  })

  try {
    await sendParentVerificationEmail({
      to: parentEmail,
      childName: profile.display_name,
      token,
      kind: 'initial',
    })
    await prisma.profile.update({
      where: { id: profile.id },
      data: { parent_verify_sent_at: new Date() },
    })
  } catch (err) {
    // Email saved — the daily cron will retry the send.
    console.error('parent-verification/set-email send failed:', err)
  }

  return NextResponse.json({ ok: true })
}
