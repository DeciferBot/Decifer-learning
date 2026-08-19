/**
 * Decifer Skills Check — the report email.
 *
 * Sent to a parent, in exchange for their email, right after a check finishes.
 * The parent is an adult, so this sits outside the Children's Code restriction
 * on messaging children. Nothing is ever emailed to a child.
 *
 * Every email carries a one-click delete link. A parent who regrets giving their
 * address must be able to undo it without writing to anybody.
 *
 * Best-effort: a failure to send must never break the result page. The report is
 * already readable on the web at the same link.
 */

import 'server-only'
import { Resend } from 'resend'
import type { AttemptView } from './server'
import { prettyYear, prettySubject } from './server'

const FROM = 'Decifer Learning <hello@deciferlearning.com>'

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

const VERDICT_LABEL: Record<string, string> = {
  secure: 'Secure',
  developing: 'Developing',
  needs_work: 'Needs work',
}

/** Lowercases the first letter only, for a phrase used mid-sentence. */
function lowerFirst(s: string): string {
  return s.length === 0 ? s : s[0].toLowerCase() + s.slice(1)
}

const VERDICT_COLOUR: Record<string, string> = {
  secure: '#40C057',
  developing: '#FFC107',
  needs_work: '#FF6B6B',
}

/**
 * Send the report.
 *
 * Takes the already-unlocked view rather than re-reading it, so the email can
 * never contain more than the page does.
 */
export async function sendSkillsCheckReport(view: AttemptView, to: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) return
    if (!view.report) return

    const year = prettyYear(view.yearLabel)
    const subject = prettySubject(view.subjectName)
    const reportUrl = `${appUrl()}/skills-check/r/${view.token}`
    const deleteUrl = `${appUrl()}/skills-check/forget/${view.token}`

    const strandRows = view.report.strands
      .map(
        (s) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#2D3748">${escapeHtml(s.strandTitle)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;color:${VERDICT_COLOUR[s.verdict] ?? '#2D3748'};font-weight:600">
        ${VERDICT_LABEL[s.verdict] ?? s.verdict} · ${s.correct}/${s.total}
      </td>
    </tr>`,
      )
      .join('')

    const nextSteps = view.report.nextSteps.length
      ? `<h2 style="margin:28px 0 8px;font-size:16px;color:#2D3748">What to do next</h2>
         <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#2D3748">
         ${view.report.nextSteps
           .map(
             (s) =>
               `<li>${
                 s.topicUrl
                   ? `<a href="${appUrl()}${s.topicUrl}" style="color:#FB5A24">${escapeHtml(s.strandTitle)}</a>`
                   : escapeHtml(s.strandTitle)
               }</li>`,
           )
           .join('')}
         </ol>`
      : `<p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#2D3748">Every area we checked came out secure. The next useful step is a check for the year above.</p>`

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#FAFBFF">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="padding-bottom:24px">
    <span style="font-size:22px;font-weight:700;color:#FB5A24">Decifer</span><span style="font-size:22px;font-weight:700;color:#2D3748"> Learning</span>
  </td></tr>
  <tr><td>
    <h1 style="margin:0 0 4px;font-size:20px;color:#2D3748">${escapeHtml(view.teaser.headline)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#718096">
      Based on ${view.report.totalItems} questions covering ${year} ${escapeHtml(subject)}. Score ${view.report.rawScore} out of ${view.report.totalItems}.
    </p>
  </td></tr>
  <tr><td>
    <h2 style="margin:0 0 4px;font-size:16px;color:#2D3748">The four areas we checked</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${strandRows}</table>
  </td></tr>
  <tr><td>${nextSteps}</td></tr>
  <tr><td style="padding:24px 0 0">
    <a href="${reportUrl}" style="display:inline-block;background:#FB5A24;color:#fff;padding:14px 28px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px">See the full report</a>
  </td></tr>
  <tr><td style="padding:24px 0 0">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#718096;background:#fff;border:1px solid #eee;border-radius:10px;padding:14px">
      <strong style="color:#2D3748">What this does and does not tell you.</strong><br>
      This is ${view.report.totalItems} questions on one day, covering four areas of the ${year} curriculum. It is not an IQ test and not a standardised score, and it does not compare your child with anyone else. One tired morning moves the result.
    </p>
  </td></tr>
  <tr><td style="padding:24px 0 0;font-size:11px;color:#a0aec0;border-top:1px solid #eee">
    You asked for this report on deciferlearning.com. We hold your email address and nothing about your child.
    <a href="${deleteUrl}" style="color:#a0aec0">Delete this report and my email</a>
  </td></tr>
</table>
</td></tr></table></body></html>`

    const text = [
      view.teaser.headline,
      `Score ${view.report.rawScore} out of ${view.report.totalItems}, covering ${year} ${subject}.`,
      '',
      'The four areas we checked:',
      ...view.report.strands.map(
        (s) => `- ${s.strandTitle}: ${VERDICT_LABEL[s.verdict] ?? s.verdict} (${s.correct}/${s.total})`,
      ),
      '',
      view.report.nextSteps.length
        ? `What to do next: ${view.report.nextSteps.map((s) => s.strandTitle).join(', ')}`
        : 'Every area we checked came out secure.',
      '',
      `Full report: ${reportUrl}`,
      '',
      `This is ${view.report.totalItems} questions on one day. It is not an IQ test and not a standardised score.`,
      `Delete this report and your email: ${deleteUrl}`,
    ].join('\n')

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      to,
      // The headline already ends in a full stop, so putting it in front of a
      // second phrase produced "Working below Year 4 maths. Your child's Year 4
      // maths check" in a real inbox — two sentences jammed together, saying
      // "Year 4 maths" twice. Lead with what the email is, then the finding.
      subject: `Your child's ${year} ${subject} check: ${lowerFirst(view.teaser.headline.replace(/\.$/, ''))}`,
      html,
      text,
    })
  } catch {
    // Best-effort only. The report is already on the page at the same link.
  }
}
