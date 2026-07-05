// Re-engagement emails for child accounts, sent by /api/cron/engagement-nudge.
//
// Two flows:
//   • activation — the child registered but has never completed a quiz
//   • comeback   — the child was active but has gone idle for a while
//
// Routing (decided with the product owner): parent-first, child as fallback.
// If the child has a linked parent we email the parent; only when there is no
// parent do we email the child directly — and never to a synthetic
// (parent-created) address, which can't receive mail. This keeps proactive
// emails to minors to a minimum, in line with the UK Children's Code.

import { Resend } from 'resend'

const FROM = 'Decifer Learning <hello@deciferlearning.com>'

// Stop nudging after this many sends (per flow). Matches the parent-verify cap.
export const MAX_ENGAGEMENT_SENDS = 3
// Minimum gap between nudges to the same child (per flow).
export const ENGAGEMENT_GAP_MS = 3 * 24 * 60 * 60 * 1000
// A child is "idle" (eligible for a comeback nudge) after this long with no activity.
export const COMEBACK_IDLE_MS = 7 * 24 * 60 * 60 * 1000

// Parent-created child logins use an @decifer.internal address that cannot
// receive email. Only real addresses are valid direct-to-child recipients.
export function isRealEmail(email: string | null | undefined): email is string {
  return !!email && !email.toLowerCase().endsWith('@decifer.internal')
}

export type EngagementFlow = 'activation' | 'comeback'
// Who the email is addressed to — changes tone (3rd person vs 2nd person).
export type Audience = 'parent' | 'child'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.deciferlearning.com'
}

// display_name is child-entered free text — escape before embedding in HTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function copy(flow: EngagementFlow, audience: Audience, rawName: string) {
  const childUrl = `${appUrl()}/dashboard/child`
  if (audience === 'child') {
    if (flow === 'activation') {
      return {
        subject: `${rawName}, your first quiz is waiting 🎒`,
        heading: `Ready for your first quiz, ${rawName}?`,
        bodyText:
          `You're all set up on Decifer Learning, but you haven't tried a quiz yet. ` +
          `Pick a topic, answer a few questions, and you'll earn your first Discovery Card.`,
        cta: 'Start your first quiz →',
        url: childUrl,
      }
    }
    return {
      subject: `We've missed you, ${rawName} 👋`,
      heading: `Come back and keep your streak going, ${rawName}`,
      bodyText:
        `It's been a little while since your last quiz on Decifer Learning. ` +
        `Just one quick session today keeps your progress moving and your streak alive.`,
      cta: 'Jump back in →',
      url: childUrl,
    }
  }
  // audience === 'parent'
  const parentUrl = `${appUrl()}/dashboard/parent`
  if (flow === 'activation') {
    return {
      subject: `${rawName} hasn't started on Decifer yet`,
      heading: `Help ${rawName} get started`,
      bodyText:
        `${rawName}'s Decifer Learning account is ready, but they haven't completed a quiz yet. ` +
        `A quick 10-minute session together is the easiest way to get the ball rolling — they'll ` +
        `earn their first Discovery Card for finishing one quiz.`,
      cta: `Open ${rawName}'s dashboard →`,
      url: parentUrl,
    }
  }
  return {
    subject: `${rawName} has gone quiet on Decifer`,
    heading: `${rawName} hasn't practised in a while`,
    bodyText:
      `${rawName} was doing well on Decifer Learning but hasn't done a quiz in over a week. ` +
      `A gentle nudge — or doing a session together — is often all it takes to get back into the habit.`,
    cta: `See ${rawName}'s progress →`,
    url: parentUrl,
  }
}

export async function sendEngagementEmail(opts: {
  to: string
  childName: string
  flow: EngagementFlow
  audience: Audience
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured')
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const rawName = opts.childName || (opts.audience === 'child' ? 'there' : 'your child')
  const name = escapeHtml(rawName)
  const c = copy(opts.flow, opts.audience, rawName)
  const heading = escapeHtml(c.heading)
  const body = escapeHtml(c.bodyText)
  const cta = escapeHtml(c.cta)

  const footer =
    opts.audience === 'parent'
      ? `You're receiving this because you're a Decifer Learning parent of ${name}.`
      : `You're receiving this because you have a Decifer Learning account.`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#FAFBFF">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding-bottom:24px">
      <span style="font-size:22px;font-weight:700;color:#FB5A24">DECIFER</span>
      <span style="font-size:22px;font-weight:700;color:#2D3748"> Learning</span>
    </td></tr>
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:20px;color:#2D3748">${heading}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#2D3748">${body}</p>
    </td></tr>
    <tr><td style="padding:8px 0 24px">
      <a href="${c.url}" style="display:inline-block;background:#FB5A24;color:#fff;padding:14px 28px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px">${cta}</a>
    </td></tr>
    <tr><td style="padding:24px 0 0;font-size:11px;color:#a0aec0;border-top:1px solid #eee">
      ${footer} · <a href="${appUrl()}/legal/privacy" style="color:#a0aec0">Privacy policy</a>
    </td></tr>
  </table>
  </td></tr></table></body></html>`

  const text = [c.heading, '', c.bodyText, '', `${c.cta} ${c.url}`].join('\n')

  const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject: c.subject, html, text })
  if (error) throw new Error(`Resend: ${error.message}`)
}
