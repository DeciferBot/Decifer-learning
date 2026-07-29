// Streak resolution, including freezes.
//
// "Streak Shield" was a misnomer. The item existed, the child was shown a count
// of them on the home screen, and the tooltip said it saved a heart in a quiz —
// so the thing named after the streak was the one thing that could not protect
// it. Miss a single day and the streak went straight back to 1. The longest
// streak any child has ever reached on this product is 4 days.
//
// Shields now do what their name says. Duolingo's own testing found that letting
// a user hold two freezes raised daily retention over holding one, because it
// removes the anxiety without removing the loss aversion, so two is the cap.
//
// Hearts are a Zone Guardian mechanic now (see QuizShell), and they no longer
// consume anything.

/** Most freezes a child may hold at once. */
export const MAX_STREAK_FREEZES = 2

/** A freeze is awarded every time the streak reaches a multiple of this. */
export const FREEZE_AWARD_EVERY = 3

export type StreakOutcome = {
  /** The streak to store, after any freeze has been applied. */
  streakDays: number
  /** False when the child has already been counted today; the caller can skip its write. */
  changed: boolean
  /** Freezes to deduct from the child's balance. */
  freezesUsed: number
  /** True when a freeze rescued a streak that would otherwise have reset to 1. */
  streakSaved: boolean
}

/** Midnight UTC for a date, so a gap is whole days and never hours. */
function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

const DAY_MS = 86_400_000

/**
 * Work out a child's streak for an activity happening now.
 *
 * PURE: no DB, no clock of its own. `now` is always supplied by the caller so
 * this is deterministic under test.
 *
 * Dates are compared in UTC, matching the behaviour this replaced.
 */
export function resolveStreak(opts: {
  lastActive: Date | null
  streakDays: number
  freezesAvailable: number
  now: Date
}): StreakOutcome {
  const { lastActive, streakDays, freezesAvailable, now } = opts

  // Never played: today is day one.
  if (!lastActive) {
    return { streakDays: 1, changed: true, freezesUsed: 0, streakSaved: false }
  }

  const gapDays = Math.round((utcDayStart(now) - utcDayStart(lastActive)) / DAY_MS)

  // Already counted today. Idempotent by design: the home screen calls this on
  // every mount.
  if (gapDays <= 0) {
    return { streakDays, changed: false, freezesUsed: 0, streakSaved: false }
  }

  // Played yesterday: the ordinary case.
  if (gapDays === 1) {
    return { streakDays: streakDays + 1, changed: true, freezesUsed: 0, streakSaved: false }
  }

  // A gap of N days means N-1 days were missed.
  const missedDays = gapDays - 1
  if (missedDays <= MAX_STREAK_FREEZES && freezesAvailable >= missedDays) {
    return {
      streakDays: streakDays + 1,
      changed: true,
      freezesUsed: missedDays,
      streakSaved: true,
    }
  }

  // Too long away, or not enough freezes to cover it.
  return { streakDays: 1, changed: true, freezesUsed: 0, streakSaved: false }
}

/**
 * Whether finishing a round at this streak length earns a freeze.
 *
 * Awarded on every third day of a streak and capped at MAX_STREAK_FREEZES held,
 * so a child who plays regularly builds a small buffer, and one who has already
 * banked two does not accumulate more.
 */
export function earnsFreeze(newStreakDays: number, currentlyHeld: number): boolean {
  if (currentlyHeld >= MAX_STREAK_FREEZES) return false
  if (newStreakDays <= 0) return false
  return newStreakDays % FREEZE_AWARD_EVERY === 0
}
