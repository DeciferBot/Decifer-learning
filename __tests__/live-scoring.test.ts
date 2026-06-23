import { describe, it, expect } from 'vitest'
import {
  computeLivePoints,
  liveDeciferPoints,
  LIVE_BASE_POINTS,
  LIVE_DECIFER_POINTS_PER_CORRECT,
} from '@/lib/live/scoring'
import { buildChoices, choiceSeed, normalizeAnswer, shuffle } from '@/lib/live/questions'

describe('computeLivePoints', () => {
  it('awards nothing for a wrong answer', () => {
    expect(computeLivePoints({ correct: false, msTaken: 10, limitMs: 20000, streakBefore: 5 })).toBe(0)
  })

  it('awards full base for an instant correct answer with no streak', () => {
    expect(computeLivePoints({ correct: true, msTaken: 0, limitMs: 20000, streakBefore: 0 })).toBe(
      LIVE_BASE_POINTS,
    )
  })

  it('halves speed points at the buzzer', () => {
    // At the time limit, speed factor = 0.5 → 500, plus no streak bonus.
    expect(computeLivePoints({ correct: true, msTaken: 20000, limitMs: 20000, streakBefore: 0 })).toBe(
      LIVE_BASE_POINTS / 2,
    )
  })

  it('adds a streak bonus that is capped', () => {
    const withStreak = computeLivePoints({ correct: true, msTaken: 0, limitMs: 20000, streakBefore: 3 })
    expect(withStreak).toBe(LIVE_BASE_POINTS + 3 * 25)
    // Cap at 10 streak.
    const capped = computeLivePoints({ correct: true, msTaken: 0, limitMs: 20000, streakBefore: 50 })
    expect(capped).toBe(LIVE_BASE_POINTS + 10 * 25)
  })

  it('clamps over-limit time to the limit (no negative points)', () => {
    expect(
      computeLivePoints({ correct: true, msTaken: 999999, limitMs: 20000, streakBefore: 0 }),
    ).toBe(LIVE_BASE_POINTS / 2)
  })
})

describe('liveDeciferPoints', () => {
  it('pays per correct answer plus a podium bonus', () => {
    expect(liveDeciferPoints(5, 0)).toBe(5 * LIVE_DECIFER_POINTS_PER_CORRECT + 30)
    expect(liveDeciferPoints(5, 1)).toBe(5 * LIVE_DECIFER_POINTS_PER_CORRECT + 20)
    expect(liveDeciferPoints(5, 2)).toBe(5 * LIVE_DECIFER_POINTS_PER_CORRECT + 10)
  })
  it('gives no podium bonus outside the top three or with no rank', () => {
    expect(liveDeciferPoints(4, 3)).toBe(4 * LIVE_DECIFER_POINTS_PER_CORRECT)
    expect(liveDeciferPoints(4, null)).toBe(4 * LIVE_DECIFER_POINTS_PER_CORRECT)
  })
})

describe('question helpers', () => {
  it('normalizes answers case- and whitespace-insensitively', () => {
    expect(normalizeAnswer('  Paris ')).toBe(normalizeAnswer('paris'))
  })

  it('builds a deterministic, complete choice list (same seed = same order)', () => {
    const seed = choiceSeed('game-abc', 2)
    const a = buildChoices('correct', ['d1', 'd2', 'd3'], seed)
    const b = buildChoices('correct', ['d1', 'd2', 'd3'], seed)
    expect(a).toEqual(b)
    expect(a.sort()).toEqual(['correct', 'd1', 'd2', 'd3'].sort())
  })

  it('caps the choice list at four tiles', () => {
    const out = buildChoices('correct', ['d1', 'd2', 'd3', 'd4', 'd5'], 1)
    expect(out).toHaveLength(4)
  })

  it('deterministic shuffle is a permutation', () => {
    const input = [1, 2, 3, 4, 5]
    expect(shuffle(input, 42).sort()).toEqual(input)
  })
})
