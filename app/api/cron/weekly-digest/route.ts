// POST /api/cron/weekly-digest
// Vercel Cron — runs every Monday at 08:00 UK time (07:00 UTC, adjust for BST).
// Sends a parent digest email for every parent who has at least one active child.
// Secured by CRON_SECRET header check.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { getChildWeeklyDigestSummary, getChildWeakAreas } from '@/lib/parent-dashboard'
import { buildParentActions } from '@/lib/parent-recommendations'

const FROM = 'Decifer Learning <hello@deciferlearning.com>'

// Vercel Cron invokes the path with a GET request (and an Authorization: Bearer <CRON_SECRET>
// header when CRON_SECRET is configured). POST stays exported for manual/local invocation.
async function handler(req: Request) {
  // Verify Vercel cron secret
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Get all parents who have linked children
  const familyLinks = await prisma.familyLink.findMany({
    include: {
      parent: { select: { user_id: true, display_name: true } },
      child:  { select: { id: true, display_name: true, streak_days: true } },
    },
  })

  // Group by parent
  const byParent = new Map<string, { parentUserId: string; parentName: string; children: typeof familyLinks[number]['child'][] }>()
  for (const link of familyLinks) {
    const key = link.parent_user_id
    if (!byParent.has(key)) {
      byParent.set(key, { parentUserId: link.parent_user_id, parentName: link.parent.display_name ?? 'there', children: [] })
    }
    byParent.get(key)!.children.push(link.child)
  }

  // Resolve parent email addresses via Supabase admin SDK
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const { parentUserId, parentName, children } of byParent.values()) {
    try {
      // Look up parent email
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(parentUserId)
      if (userError || !userData?.user?.email) { skipped++; continue }
      const parentEmail = userData.user.email

      // Build per-child summaries
      const childSummaries = await Promise.all(
        children.map(async (child) => {
          const [digest, weakAreas] = await Promise.all([
            getChildWeeklyDigestSummary(child.id).catch(() => null),
            getChildWeakAreas(child.id, 2).catch(() => []),
          ])
          const actions = digest
            ? buildParentActions(child.display_name ?? 'Your child', weakAreas, digest, null, child.streak_days ?? 0)
            : []
          return { child, digest, weakAreas, actions }
        }),
      )

      // Skip if all children were inactive (nothing to report)
      const anyActive = childSummaries.some((s) => (s.digest?.quizAttempts ?? 0) > 0)
      if (!anyActive) { skipped++; continue }

      const html = buildEmailHtml(parentName, childSummaries)
      const text = buildEmailText(parentName, childSummaries)

      await resend.emails.send({
        from: FROM,
        to:   parentEmail,
        subject:
          children.length === 1
            ? `${children[0].display_name}'s weekly report card`
            : `Weekly report cards — ${children.map((c) => c.display_name).join(', ')}`,
        html,
        text,
      })
      sent++
    } catch (err) {
      errors.push(String(err))
    }
  }

  return NextResponse.json({ sent, skipped, errors: errors.slice(0, 5) })
}

export const GET = handler
export const POST = handler

// ── Email builders ────────────────────────────────────────────────────────────

type ChildSummary = {
  child: { id: string; display_name: string | null; streak_days: number | null }
  digest: { quizAttempts: number; activeDays: number; passRate: number | null; pointsThisWeek: number; topicsCompleted: number } | null
  actions: { label: string; text: string; urgency: string }[]
}

function buildEmailHtml(parentName: string, summaries: ChildSummary[]): string {
  const childBlocks = summaries
    .map(({ child, digest, actions }) => {
      const name = child.display_name ?? 'Your child'
      const streak = child.streak_days ?? 0
      if (!digest || digest.quizAttempts === 0) {
        return `<tr><td style="padding:16px 0;border-top:1px solid #eee">
          <strong>${name}</strong> didn't do any quizzes this week. Encouraging a 10-minute session today can make a difference.
        </td></tr>`
      }
      const passNote = digest.passRate !== null ? `${digest.passRate}% pass rate` : ''
      const actionsHtml = actions.length > 0
        ? `<ul style="margin:8px 0;padding-left:20px">${actions.map((a) => `<li style="margin-bottom:6px;font-size:14px;color:#2D3748">${a.text}</li>`).join('')}</ul>`
        : ''
      return `<tr><td style="padding:16px 0;border-top:1px solid #eee">
        <strong style="font-size:16px">${name}</strong>
        ${streak >= 3 ? `<span style="margin-left:8px;color:#FF8F00">🔥 ${streak}-day streak</span>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0">
          <tr>
            <td align="center" style="padding:8px;background:#f8f9ff;border-radius:8px">
              <div style="font-size:20px;font-weight:bold;color:#2D3748">${digest.quizAttempts}</div>
              <div style="font-size:11px;color:#718096">quizzes</div>
            </td>
            <td width="8"></td>
            <td align="center" style="padding:8px;background:#f8f9ff;border-radius:8px">
              <div style="font-size:20px;font-weight:bold;color:#2D3748">${digest.activeDays}</div>
              <div style="font-size:11px;color:#718096">active days</div>
            </td>
            <td width="8"></td>
            <td align="center" style="padding:8px;background:#f8f9ff;border-radius:8px">
              <div style="font-size:20px;font-weight:bold;color:${(digest.passRate ?? 0) >= 70 ? '#40C057' : '#FF6B6B'}">${digest.passRate !== null ? `${digest.passRate}%` : '—'}</div>
              <div style="font-size:11px;color:#718096">pass rate</div>
            </td>
            <td width="8"></td>
            <td align="center" style="padding:8px;background:#f8f9ff;border-radius:8px">
              <div style="font-size:20px;font-weight:bold;color:#FFC107">+${digest.pointsThisWeek.toLocaleString()}</div>
              <div style="font-size:11px;color:#718096">points</div>
            </td>
          </tr>
        </table>
        ${passNote ? `<p style="margin:4px 0;font-size:13px;color:#718096">${passNote}${digest.topicsCompleted > 0 ? ` · ${digest.topicsCompleted} topic${digest.topicsCompleted > 1 ? 's' : ''} completed` : ''}</p>` : ''}
        ${actionsHtml ? `<p style="margin:10px 0 4px;font-size:13px;font-weight:600;color:#FB5A24">What to do this week:</p>${actionsHtml}` : ''}
      </td></tr>`
    })
    .join('')

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#FAFBFF">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding-bottom:24px">
      <span style="font-size:22px;font-weight:700;color:#FB5A24">Decifer</span>
      <span style="font-size:22px;font-weight:700;color:#2D3748"> Learning</span>
    </td></tr>
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:20px;color:#2D3748">Hi ${parentName} — this week's report card</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#718096">How your child${summaries.length > 1 ? 'ren are' : ' is'} getting on this week, and what you can do to help.</p>
    </td></tr>
    ${childBlocks}
    <tr><td style="padding:24px 0 0">
      <a href="https://www.deciferlearning.com/dashboard/parent" style="display:inline-block;background:#FB5A24;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;text-decoration:none;font-size:14px">View full dashboard →</a>
    </td></tr>
    <tr><td style="padding:24px 0 0;font-size:11px;color:#a0aec0;border-top:1px solid #eee;margin-top:24px">
      You're receiving this because you're a Decifer Learning parent.
      <a href="https://www.deciferlearning.com/dashboard/parent/account" style="color:#a0aec0">Manage email preferences</a>
    </td></tr>
  </table>
  </td></tr></table></body></html>`
}

function buildEmailText(parentName: string, summaries: ChildSummary[]): string {
  const lines = [`Hi ${parentName},\n\nHere's this week's Decifer Learning report card:\n`]
  for (const { child, digest, actions } of summaries) {
    const name = child.display_name ?? 'Your child'
    lines.push(`── ${name} ──`)
    if (!digest || digest.quizAttempts === 0) {
      lines.push(`${name} didn't do any quizzes this week.`)
    } else {
      lines.push(`${digest.quizAttempts} quizzes · ${digest.activeDays} active days · ${digest.passRate !== null ? `${digest.passRate}% pass rate` : ''} · +${digest.pointsThisWeek} points`)
      if (actions.length > 0) {
        lines.push('\nWhat to do this week:')
        actions.forEach((a) => lines.push(`• ${a.text}`))
      }
    }
    lines.push('')
  }
  lines.push('View full dashboard: https://www.deciferlearning.com/dashboard/parent')
  return lines.join('\n')
}
