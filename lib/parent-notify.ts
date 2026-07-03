// Event-triggered "big moment" emails to the parent (an adult — outside the
// Children's Code restriction on messaging children). Fired non-blocking from
// the quiz/guardian submit hot paths, so this must NEVER throw and must add no
// latency to the child's response. Each moment is naturally rate-limited:
// first-win fires once ever; each badge / the guardian-win badge is awarded once.

import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const FROM = 'Decifer Learning <hello@noreply.deciferlearning.com>'

export type BigMoment =
  | { kind: 'first_win' }
  | { kind: 'badge'; badgeName: string }
  | { kind: 'guardian_win'; zoneName?: string }

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.deciferlearning.com'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function copy(rawName: string, moment: BigMoment): { subject: string; line: string } {
  switch (moment.kind) {
    case 'first_win':
      return {
        subject: `🎉 ${rawName} completed their first topic on Decifer!`,
        line: `${rawName} just passed their very first quiz and earned their first Discovery Card. A great first step — a word of encouragement from you goes a long way right now.`,
      }
    case 'badge':
      return {
        subject: `🏅 ${rawName} earned the "${moment.badgeName}" badge`,
        line: `${rawName} just unlocked the "${moment.badgeName}" badge on Decifer Learning. Worth a high five!`,
      }
    case 'guardian_win':
      return {
        subject: `⚔️ ${rawName} defeated a Zone Guardian!`,
        line: `${rawName} beat ${moment.zoneName ? `the ${moment.zoneName} Guardian` : 'a Zone Guardian'} — a 15-question boss across a whole zone — and won a Legendary card. A big milestone!`,
      }
  }
}

export async function notifyParentBigMoment(
  childProfileId: string,
  childName: string,
  moment: BigMoment,
): Promise<void> {
  try {
    if (
      !process.env.RESEND_API_KEY ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL
    ) {
      return
    }

    const child = await prisma.profile.findUnique({
      where: { id: childProfileId },
      select: { user_id: true },
    })
    if (!child) return

    const link = await prisma.familyLink.findFirst({
      where: { child_user_id: child.user_id },
      select: { parent_user_id: true },
    })
    if (!link) return // no linked parent → no one to notify

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )
    const { data, error } = await admin.auth.admin.getUserById(link.parent_user_id)
    const to = error ? null : data?.user?.email ?? null
    if (!to || to.toLowerCase().endsWith('@decifer.internal')) return

    const rawName = childName || 'Your child'
    const name = escapeHtml(rawName)
    const c = copy(rawName, moment)
    const line = escapeHtml(c.line)

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#FAFBFF">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding-bottom:24px">
      <span style="font-size:22px;font-weight:700;color:#F05A28">DECIFER</span>
      <span style="font-size:22px;font-weight:700;color:#2D3748"> Learning</span>
    </td></tr>
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:20px;color:#2D3748">A milestone for ${name} 🎉</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#2D3748">${line}</p>
    </td></tr>
    <tr><td style="padding:8px 0 24px">
      <a href="${appUrl()}/dashboard/parent" style="display:inline-block;background:#F05A28;color:#fff;padding:14px 28px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px">See ${name}'s progress →</a>
    </td></tr>
    <tr><td style="padding:24px 0 0;font-size:11px;color:#a0aec0;border-top:1px solid #eee">
      You're receiving this because you're a Decifer Learning parent of ${name}.
      <a href="${appUrl()}/dashboard/parent/account" style="color:#a0aec0">Manage email preferences</a>
    </td></tr>
  </table>
  </td></tr></table></body></html>`

    const text = [c.line, '', `See ${rawName}'s progress: ${appUrl()}/dashboard/parent`].join('\n')

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({ from: FROM, to, subject: c.subject, html, text })
  } catch {
    // Best-effort only — never break the child's quiz response.
  }
}
