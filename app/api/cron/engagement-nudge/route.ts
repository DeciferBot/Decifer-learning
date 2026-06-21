// GET/POST /api/cron/engagement-nudge
// Vercel Cron — daily. Re-engages child accounts that have stalled:
//   • activation — registered but never completed a quiz
//   • comeback   — was active but idle for COMEBACK_IDLE_MS
// Routing is parent-first: email the linked parent when there is one, else the
// child directly (real address only — synthetic @decifer.internal logins are
// skipped). Each flow is capped at MAX_ENGAGEMENT_SENDS, spaced ENGAGEMENT_GAP_MS
// apart. Secured by CRON_SECRET header check (same pattern as weekly-digest).

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import {
  sendEngagementEmail,
  isRealEmail,
  MAX_ENGAGEMENT_SENDS,
  ENGAGEMENT_GAP_MS,
  COMEBACK_IDLE_MS,
  type EngagementFlow,
} from '@/lib/engagement-emails'

async function handler(req: Request) {
  const secret =
    req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const now = Date.now()

  const children = await prisma.profile.findMany({
    where: { role: 'child' },
    select: {
      id: true,
      user_id: true,
      display_name: true,
      last_active: true,
      activation_email_sent_at: true,
      activation_email_count: true,
      comeback_email_sent_at: true,
      comeback_email_count: true,
      family_as_child: { select: { parent_user_id: true }, take: 1 },
      _count: { select: { quiz_attempts: true } },
    },
  })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // Small cache so we never resolve the same auth user twice in one run.
  const emailCache = new Map<string, string | null>()
  async function emailFor(userId: string): Promise<string | null> {
    if (emailCache.has(userId)) return emailCache.get(userId)!
    const { data, error } = await admin.auth.admin.getUserById(userId)
    const email = error ? null : data?.user?.email ?? null
    emailCache.set(userId, email)
    return email
  }

  let sent = 0
  let skipped = 0
  const byFlow = { activation: 0, comeback: 0 }
  const errors: string[] = []

  for (const c of children) {
    try {
      const played = c._count.quiz_attempts > 0
      // Determine which flow (if any) the child qualifies for.
      let flow: EngagementFlow | null = null
      if (!played) {
        flow = 'activation'
      } else if (c.last_active && now - c.last_active.getTime() >= COMEBACK_IDLE_MS) {
        flow = 'comeback'
      }
      if (!flow) { skipped++; continue }

      const count = flow === 'activation' ? c.activation_email_count : c.comeback_email_count
      const sentAt = flow === 'activation' ? c.activation_email_sent_at : c.comeback_email_sent_at
      if (count >= MAX_ENGAGEMENT_SENDS) { skipped++; continue }
      if (sentAt && now - sentAt.getTime() < ENGAGEMENT_GAP_MS) { skipped++; continue }

      // Parent-first routing, child as fallback.
      const parentUserId = c.family_as_child[0]?.parent_user_id ?? null
      let to: string | null = null
      let audience: 'parent' | 'child' = 'parent'
      if (parentUserId) {
        to = await emailFor(parentUserId)
        audience = 'parent'
      } else {
        const childEmail = await emailFor(c.user_id)
        if (isRealEmail(childEmail)) { to = childEmail; audience = 'child' }
      }
      if (!to) { skipped++; continue }

      await sendEngagementEmail({ to, childName: c.display_name, flow, audience })

      await prisma.profile.update({
        where: { id: c.id },
        data:
          flow === 'activation'
            ? { activation_email_sent_at: new Date(), activation_email_count: { increment: 1 } }
            : { comeback_email_sent_at: new Date(), comeback_email_count: { increment: 1 } },
      })
      sent++
      byFlow[flow]++
    } catch (err) {
      errors.push(String(err))
    }
  }

  return NextResponse.json({ candidates: children.length, sent, skipped, byFlow, errors: errors.slice(0, 5) })
}

export const GET = handler
export const POST = handler
