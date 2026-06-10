// Parent/guardian email verification for self-registered child accounts.
// Shared by POST /api/parent-verification/send (immediate, post-signup) and
// GET /api/cron/parent-verify (daily reminders until confirmed).

import { Resend } from 'resend'

const FROM = 'Decifer Learning <hello@deciferlearning.com>'

// Stop nagging after this many reminders (initial email not counted).
export const MAX_VERIFY_REMINDERS = 3
// Minimum gap between verification emails to the same parent.
export const VERIFY_REMINDER_GAP_MS = 3 * 24 * 60 * 60 * 1000

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.deciferlearning.com'
}

// display_name is child-entered free text — escape it before embedding in HTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function parentVerifyUrl(token: string): string {
  return `${appUrl()}/verify-parent?token=${encodeURIComponent(token)}`
}

export async function sendParentVerificationEmail(opts: {
  to: string
  childName: string
  token: string
  kind: 'initial' | 'reminder'
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured')
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = parentVerifyUrl(opts.token)
  const rawName = opts.childName || 'Your child'
  const childName = escapeHtml(rawName)

  // Subject + plain-text use the raw name; only the HTML body uses the escaped one.
  const subject =
    opts.kind === 'initial'
      ? `${rawName} joined Decifer Learning — please confirm`
      : `Reminder: please confirm ${rawName}'s Decifer Learning account`

  const introText =
    opts.kind === 'initial'
      ? `${rawName} has created an account on Decifer Learning, a UK National Curriculum learning app, and gave this address as their parent or guardian's email.`
      : `${rawName} created an account on Decifer Learning and gave this address as their parent or guardian's email. We haven't heard from you yet, so here's a gentle reminder.`
  const intro = escapeHtml(introText)

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#FAFBFF">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding-bottom:24px">
      <span style="font-size:22px;font-weight:700;color:#F05A28">DECIFER</span>
      <span style="font-size:22px;font-weight:700;color:#2D3748"> Learning</span>
    </td></tr>
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:20px;color:#2D3748">Please confirm ${childName}'s account</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#2D3748">${intro}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#2D3748">
        Under the UK Children's Code we need a parent or guardian to confirm they're happy for
        ${childName} to use Decifer Learning. It takes one tap:
      </p>
    </td></tr>
    <tr><td style="padding:8px 0 24px">
      <a href="${url}" style="display:inline-block;background:#F05A28;color:#fff;padding:14px 28px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px">Confirm ${childName}'s account →</a>
    </td></tr>
    <tr><td>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#718096">
        Once confirmed, you can also create a free parent account with this email address to see
        ${childName}'s progress, set screen-time limits, and get weekly updates.
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#718096">
        If you don't recognise this, you can safely ignore this email — or reply and we'll remove the account.
      </p>
    </td></tr>
    <tr><td style="padding:24px 0 0;font-size:11px;color:#a0aec0;border-top:1px solid #eee">
      Decifer Learning · <a href="${appUrl()}/legal/privacy" style="color:#a0aec0">Privacy policy</a>
    </td></tr>
  </table>
  </td></tr></table></body></html>`

  const text = [
    `Please confirm ${rawName}'s Decifer Learning account`,
    '',
    introText,
    '',
    `Under the UK Children's Code we need a parent or guardian to confirm they're happy for ${rawName} to use Decifer Learning.`,
    '',
    `Confirm here: ${url}`,
    '',
    `Once confirmed, you can also create a free parent account with this email address to follow ${rawName}'s progress.`,
    `If you don't recognise this, you can safely ignore this email.`,
  ].join('\n')

  const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject, html, text })
  if (error) throw new Error(`Resend: ${error.message}`)
}
