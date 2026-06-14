/**
 * SM-2 spaced-repetition tests — guards the exact algorithm in CLAUDE.md §10.
 *
 * SM-2 decides WHEN every completed topic resurfaces for review. A silent
 * regression here means children either never revisit weak topics or get
 * drilled on mastered ones. These tests pin the spec'd behaviour.
 */

import { describe, it, expect } from 'vitest'
import { sm2 } from '../lib/sm2'

describe('sm2', () => {
  it('resets repetitions and interval to 1 on a failing grade (quality < 3)', () => {
    const r = sm2(2, 5, 2.5, 30)
    expect(r.reps).toBe(0)
    expect(r.interval).toBe(1)
    expect(r.easiness).toBe(2.5) // easiness preserved on lapse
  })

  it('treats quality 3 as the lowest passing grade (no reset)', () => {
    const r = sm2(3, 0, 2.5, 1)
    expect(r.reps).toBe(1)
    expect(r.interval).toBe(1)
  })

  it('schedules first review at 1 day and second at 6 days', () => {
    const first = sm2(4, 0, 2.5, 1)
    expect(first.reps).toBe(1)
    expect(first.interval).toBe(1)

    const second = sm2(4, 1, first.easiness, first.interval)
    expect(second.reps).toBe(2)
    expect(second.interval).toBe(6)
  })

  it('grows the interval by round(interval * easiness) from the third review on', () => {
    const easiness = 2.5
    const r = sm2(4, 2, easiness, 6)
    expect(r.reps).toBe(3)
    expect(r.interval).toBe(Math.round(6 * r.easiness))
  })

  it('never lets easiness fall below the SM-2 floor of 1.3', () => {
    let easiness = 1.3
    // Repeatedly grade at the minimum pass — easiness must clamp, not drift below.
    for (let i = 0; i < 10; i++) {
      const r = sm2(3, i, easiness, 6)
      easiness = r.easiness
      expect(easiness).toBeGreaterThanOrEqual(1.3)
    }
  })

  it('raises easiness for a perfect grade and lowers it for a marginal pass', () => {
    const perfect = sm2(5, 1, 2.5, 6)
    const marginal = sm2(3, 1, 2.5, 6)
    expect(perfect.easiness).toBeGreaterThan(2.5)
    expect(marginal.easiness).toBeLessThan(2.5)
  })

  it('matches the documented worked example (quality 4, fresh card)', () => {
    // CLAUDE.md §10: e = max(1.3, easiness + 0.1 - (5-q)*(0.08 + (5-q)*0.02))
    const r = sm2(4, 0, 2.5, 1)
    const expectedE = Math.max(1.3, 2.5 + 0.1 - (5 - 4) * (0.08 + (5 - 4) * 0.02))
    expect(r.easiness).toBeCloseTo(expectedE, 10)
  })
})
