/**
 * Decifer Reasoning Check — the report email.
 *
 * Sent to a parent, in exchange for their email, right after the test finishes.
 * The parent is an adult, so this sits outside the Children's Code restriction
 * on messaging children. Nothing is ever emailed to a child.
 *
 * Every email carries a one-click delete link. A parent who regrets giving their
 * address must be able to undo it without writing to anybody.
 *
 * THE LINE THIS EMAIL MUST NOT CROSS: no IQ number, no percentile, no
 * standardised score, no comparison with another child. The honest box near the
 * bottom is not a disclaimer bolted on, it is the part a parent searching for
 * "free IQ test for kids" most needs to read.
 *
 * Best-effort: a failure to send must never break the result page. The report is
 * already readable on the web at the same link.
 */

import 'server-only'
import { Resend } from 'resend'
import type { ReasoningAttemptView } from './server'
import { formatMs } from './score'

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
  strong: 'Strong',
  developing: 'Developing',
  needs_practice: 'Needs practice',
}

const VERDICT_COLOUR: Record<string, string> = {
  strong: '#40C057',
  developing: '#FFC107',
  needs_practice: '#FF6B6B',
}

/**
 * Send the report.
 *
 * Takes the already-unlocked view rather than re-reading it, so the email can
 * never contain more than the page does.
 */
export async function sendReasoningReport(
  view: ReasoningAttemptView,
  to: string,
): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) return
    if (!view.report) return

    const report = view.report
    const reportUrl = `${appUrl()}/reasoning/r/${view.token}`
    const deleteUrl = `${appUrl()}/reasoning/forget/${view.token}`

    const typeRows = report.types
      .map(
        (t) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#2D3748">
        ${escapeHtml(t.label)}<br>
        <span style="font-size:12px;color:#718096">
          ${t.levelReached > 0 ? `Level ${t.levelReached} reached` : 'No level reached'} · typically ${escapeHtml(formatMs(t.medianTimeMs))} a question
        </span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;color:${VERDICT_COLOUR[t.verdict] ?? '#2D3748'};font-weight:600">
        ${VERDICT_LABEL[t.verdict] ?? t.verdict} · ${t.correct}/${t.total}
      </td>
    </tr>`,
      )
      .join('')

    const practice = report.practice.length
      ? `<h2 style="margin:28px 0 8px;font-size:16px;color:#2D3748">What to practise</h2>
         <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#2D3748">
         ${report.practice
           .map(
             (p) =>
               `<li><a href="${appUrl()}${p.url}" style="color:#FB5A24;font-weight:600">${escapeHtml(p.label)}</a><br>${escapeHtml(p.tip)}</li>`,
           )
           .join('')}
         </ol>`
      : `<p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#2D3748">Every kind of puzzle came out strong. The useful next step is simply a harder set, or the same test again in four weeks.</p>`

    const slowest = report.slowestTypeLabel
      ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#718096">Slowest to work through: ${escapeHtml(report.slowestTypeLabel.toLowerCase())}. Speed matters on tests like the CAT4 and the 11+, so a type that is right but slow is still worth practising.</p>`
      : ''

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#FAFBFF">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="padding-bottom:24px">
    <span style="font-size:22px;font-weight:700;color:#FB5A24">Decifer</span><span style="font-size:22px;font-weight:700;color:#2D3748"> Learning</span>
  </td></tr>
  <tr><td>
    <h1 style="margin:0 0 4px;font-size:20px;color:#2D3748">${escapeHtml(view.teaser.headline)}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#718096">
      Based on ${report.totalItems} non-verbal reasoning questions. ${report.rawScore} of ${report.totalItems} correct.
    </p>
  </td></tr>
  <tr><td>
    <h2 style="margin:0 0 4px;font-size:16px;color:#2D3748">The four kinds of puzzle</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${typeRows}</table>
    ${slowest}
  </td></tr>
  <tr><td>${practice}</td></tr>
  <tr><td style="padding:24px 0 0">
    <a href="${reportUrl}" style="display:inline-block;background:#FB5A24;color:#fff;padding:14px 28px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px">See the full report</a>
  </td></tr>
  <tr><td style="padding:24px 0 0">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#718096;background:#fff;border:1px solid #eee;border-radius:10px;padding:14px">
      <strong style="color:#2D3748">Why there is no IQ number here.</strong><br>
      This test measures the same kind of thinking an IQ test or a CAT4 non-verbal paper measures: spotting patterns and reasoning about shapes. It does not produce an IQ score, and it should not. An IQ score, and the CAT4's own SAS score, place a child against a large standardised sample of children the same age. We have no such sample, so any number we printed on that scale would be invented. What you have above is what actually happened: how many were right, how hard they got, and how long they took.
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
      `${report.rawScore} of ${report.totalItems} correct across four kinds of non-verbal reasoning puzzle.`,
      '',
      'The four kinds of puzzle:',
      ...report.types.map(
        (t) =>
          `- ${t.label}: ${VERDICT_LABEL[t.verdict] ?? t.verdict} (${t.correct}/${t.total}), ${
            t.levelReached > 0 ? `level ${t.levelReached} reached` : 'no level reached'
          }, typically ${formatMs(t.medianTimeMs)} a question`,
      ),
      '',
      report.practice.length
        ? `What to practise: ${report.practice.map((p) => p.label).join(', ')}`
        : 'Every kind of puzzle came out strong.',
      '',
      `Full report: ${reportUrl}`,
      '',
      'Why there is no IQ number: this measures the same thinking an IQ test measures, but an IQ score places a child against a large standardised sample we do not have. Any number on that scale would be invented.',
      `Delete this report and your email: ${deleteUrl}`,
    ].join('\n')

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      // Leads with what the email is, then the finding. The headline ends in a
      // full stop, so putting it first produced two sentences jammed together in
      // a real inbox on the Skills Check.
      subject: `Your child's reasoning check: ${view.teaser.headline.replace(/\.$/, '').toLowerCase()}`,
      to,
      html,
      text,
    })
  } catch {
    // Best-effort only. The report is already on the page at the same link.
  }
}
