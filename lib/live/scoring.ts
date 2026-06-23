// Decifer Live — Kahoot-style speed scoring. Pure functions, computed
// SERVER-SIDE only (CLAUDE.md §4: never trust the client for correctness or
// timing). The in-game score below drives the live leaderboard; at game end a
// modest amount of real Decifer points is logged to point_events so Live ties
// into the existing economy without inflating it.

// Maximum points for a correct answer given instantly.
export const LIVE_BASE_POINTS = 1000
// A correct answer at the very last moment still earns this fraction of base.
const MIN_SPEED_FRACTION = 0.5
// Bonus per consecutive-correct streak, capped — rewards momentum like Kahoot.
const STREAK_BONUS_PER = 25
const STREAK_BONUS_CAP = 10

export type LivePointsInput = {
  correct: boolean
  msTaken: number // server-measured time from question start to answer
  limitMs: number // seconds_per_question * 1000
  streakBefore: number // the player's consecutive-correct count BEFORE this answer
}

// Returns the in-game points for a single answer. Wrong / timed-out = 0.
export function computeLivePoints({ correct, msTaken, limitMs, streakBefore }: LivePointsInput): number {
  if (!correct) return 0
  const safeLimit = Math.max(1, limitMs)
  const frac = Math.min(1, Math.max(0, msTaken / safeLimit))
  // Linear decay from 1.0 (instant) to MIN_SPEED_FRACTION (at the buzzer).
  const speedFactor = 1 - (1 - MIN_SPEED_FRACTION) * frac
  const speedPoints = Math.round(LIVE_BASE_POINTS * speedFactor)
  const streakBonus = Math.min(streakBefore, STREAK_BONUS_CAP) * STREAK_BONUS_PER
  return speedPoints + streakBonus
}

// Real Decifer points logged to point_events when a game finishes. Kept modest:
// 10 per correct answer plus a small podium bonus for the top three.
export const LIVE_DECIFER_POINTS_PER_CORRECT = 10
export const LIVE_PODIUM_BONUS = [30, 20, 10] as const

export function liveDeciferPoints(correctCount: number, podiumRank: number | null): number {
  const base = correctCount * LIVE_DECIFER_POINTS_PER_CORRECT
  const bonus = podiumRank !== null && podiumRank >= 0 && podiumRank < LIVE_PODIUM_BONUS.length
    ? LIVE_PODIUM_BONUS[podiumRank]
    : 0
  return base + bonus
}
