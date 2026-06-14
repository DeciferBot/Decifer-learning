// Pipeline failure alerting — emails the operator when an unattended cron job
// fails or produces a regression signal, so problems surface within hours
// instead of at the next manual check. Documented plan: services/content-pipeline/GOLDEN_SET.md.
//
// Design: best-effort and NON-THROWING. Alerting must never turn a recoverable
// cron failure into an unhandled error or mask the original problem. No-ops
// quietly when RESEND_API_KEY is absent (e.g. preview deploys).

import { Resend } from 'resend'

const FROM = 'Decifer Learning <hello@deciferlearning.com>'
const OPERATOR = 'chopraa@gmail.com'

export interface PipelineAlert {
  /** Cron/job name, e.g. 'calibrate-difficulty'. */
  job: string
  /** Short human summary of what went wrong. */
  reason: string
  /** Optional structured context (error detail, counts) — JSON-stringified into the body. */
  context?: unknown
}

/**
 * Send a failure alert. Returns true if an email was dispatched, false if it
 * was skipped or failed (logged, never thrown).
 */
export async function alertPipelineFailure(alert: PipelineAlert): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[pipeline-alert] RESEND_API_KEY unset — skipping alert for ${alert.job}`)
    return false
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const when = new Date().toISOString()
    const ctx = alert.context != null ? JSON.stringify(alert.context, null, 2) : ''
    const subject = `⚠️ Decifer pipeline: ${alert.job} failed`
    const text = [
      `Job: ${alert.job}`,
      `When: ${when}`,
      `Reason: ${alert.reason}`,
      ctx ? `\nContext:\n${ctx}` : '',
    ].join('\n')
    const { error } = await resend.emails.send({ from: FROM, to: OPERATOR, subject, text })
    if (error) {
      console.error('[pipeline-alert] Resend returned an error', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[pipeline-alert] failed to send alert (non-fatal)', err)
    return false
  }
}
