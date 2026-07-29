/**
 * Client-side helpers for quiz learning events.
 *
 * WHY THIS EXISTS: `quiz_started` fires when the quiz page mounts, so it also
 * counts reloads and children who look at the difficulty picker and leave. It
 * cannot tell us where a child stops. These helpers add the two events that can:
 *
 *   quiz_first_answer — the child actually answered something
 *   quiz_abandoned    — the child left before submitting, and at which question
 *
 * Both post to /api/events/learning, which resolves the profile from the session
 * cookie. No profile ID is ever sent from the client.
 */

export type QuizEventBody = {
  eventType: 'quiz_started' | 'quiz_first_answer' | 'quiz_abandoned'
  topicId?: string | null
  subjectId?: string | null
  metadata?: Record<string, string | number | boolean>
}

const ENDPOINT = '/api/events/learning'

/** Fire-and-forget POST. Never throws, never blocks the child. */
export async function postQuizEvent(body: QuizEventBody): Promise<void> {
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Non-blocking by design.
  }
}

/**
 * Send during page teardown (pagehide / visibilitychange), where a normal fetch
 * is usually killed before it leaves. sendBeacon survives the unload; the
 * keepalive fetch is the fallback for browsers that refuse the Blob.
 */
export function beaconQuizEvent(body: QuizEventBody): void {
  const payload = JSON.stringify(body)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }
  } catch {
    // Fall through to keepalive fetch.
  }
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  } catch {
    // Non-blocking by design.
  }
}
