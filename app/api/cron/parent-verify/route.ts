// GET/POST /api/cron/parent-verify
// Vercel Cron — daily. Chases unverified parent/guardian emails on
// self-registered child accounts:
//   • never emailed (signup-time send failed) → send the initial email
//   • emailed ≥ 3 days ago, fewer than MAX_VERIFY_REMINDERS reminders → remind
// Secured by CRON_SECRET header check (same pattern as weekly-digest).

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  sendParentVerificationEmail,
  MAX_VERIFY_REMINDERS,
  VERIFY_REMINDER_GAP_MS,
} from '@/lib/parent-verification'

async function handler(req: Request) {
  const secret =
    req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const pending = await prisma.profile.findMany({
    where: {
      role: 'child',
      parent_email: { not: null },
      parent_email_verified_at: null,
      parent_verify_reminder_count: { lt: MAX_VERIFY_REMINDERS },
    },
    select: {
      id: true,
      display_name: true,
      parent_email: true,
      parent_verify_token: true,
      parent_verify_sent_at: true,
      parent_verify_reminder_count: true,
    },
  })

  let sent = 0
  let skipped = 0
  const errors: string[] = []
  const now = Date.now()

  for (const p of pending) {
    try {
      const neverSent = !p.parent_verify_sent_at
      const dueReminder =
        !neverSent && now - p.parent_verify_sent_at!.getTime() >= VERIFY_REMINDER_GAP_MS
      if (!neverSent && !dueReminder) {
        skipped++
        continue
      }

      let token = p.parent_verify_token
      if (!token) {
        token = randomUUID()
        await prisma.profile.update({ where: { id: p.id }, data: { parent_verify_token: token } })
      }

      await sendParentVerificationEmail({
        to: p.parent_email!,
        childName: p.display_name,
        token,
        kind: neverSent ? 'initial' : 'reminder',
      })
      await prisma.profile.update({
        where: { id: p.id },
        data: {
          parent_verify_sent_at: new Date(),
          ...(neverSent ? {} : { parent_verify_reminder_count: { increment: 1 } }),
        },
      })
      sent++
    } catch (err) {
      errors.push(String(err))
    }
  }

  return NextResponse.json({ pending: pending.length, sent, skipped, errors: errors.slice(0, 5) })
}

export const GET = handler
export const POST = handler
