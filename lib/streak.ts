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
  /**
   * The last day the child finished a round, NOT the last day they opened the
   * app. Opening a screen is not learning, and a streak earned by loading a page
   * means nothing. See profiles.last_round_on.
   */
  lastRoundOn: Date | null
  streakDays: number
  freezesAvailable: number
  now: Date
}): StreakOutcome {
  const { lastRoundOn, streakDays, freezesAvailable, now } = opts

  // Never played: today is day one.
  if (!lastRoundOn) {
    return { streakDays: 1, changed: true, freezesUsed: 0, streakSaved: false }
  }

  const gapDays = Math.round((utcDayStart(now) - utcDayStart(lastRoundOn)) / DAY_MS)

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
/**
 * The streak to SHOW, given the child may not have played yet today.
 *
 * The stored `streak_days` is only corrected on the next round, so reading it
 * raw would tell a child who last played a fortnight ago that they still have a
 * 9 day streak. This reports what the streak is actually worth right now:
 *
 *   - played today or yesterday → the stored number, still live
 *   - a gap their freezes can cover → the stored number, at risk but alive
 *   - anything longer → 0, because it has lapsed
 *
 * Display only. It spends nothing and writes nothing; the freeze is not actually
 * consumed until the child plays a round.
 */
export function displayedStreak(opts: {
  lastRoundOn: Date | null
  streakDays: number
  freezesAvailable: number
  now: Date
}): number {
  const { lastRoundOn, streakDays, freezesAvailable, now } = opts
  if (!lastRoundOn || streakDays <= 0) return 0

  const gapDays = Math.round((utcDayStart(now) - utcDayStart(lastRoundOn)) / DAY_MS)
  if (gapDays <= 1) return streakDays

  const missedDays = gapDays - 1
  const covered = missedDays <= MAX_STREAK_FREEZES && freezesAvailable >= missedDays
  return covered ? streakDays : 0
}

/** True when today's round has not happened yet and the streak is still alive. */
export function streakAtRisk(opts: {
  lastRoundOn: Date | null
  streakDays: number
  freezesAvailable: number
  now: Date
}): boolean {
  if (!opts.lastRoundOn) return false
  const gapDays = Math.round((utcDayStart(opts.now) - utcDayStart(opts.lastRoundOn)) / DAY_MS)
  return gapDays >= 1 && displayedStreak(opts) > 0
}

export function earnsFreeze(newStreakDays: number, currentlyHeld: number): boolean {
  if (currentlyHeld >= MAX_STREAK_FREEZES) return false
  if (newStreakDays <= 0) return false
  return newStreakDays % FREEZE_AWARD_EVERY === 0
}
