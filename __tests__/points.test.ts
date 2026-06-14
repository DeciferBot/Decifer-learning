/**
 * Points engine tests — guards the Phase 5 scoring spec (CLAUDE.md §14 Phase 5).
 *
 * The canonical anchor: a 10/10 quiz with no hints must yield 125 points
 * (100 base + 25 perfect bonus). These tests are the regression net for that
 * contract and the hint-deduction / SM-2-quality mapping around it.
 *
 * Pure functions, no DB, no network.
 */

import { describe, it, expect } from 'vitest'
import {
  calcQuizPoints,
  scoreToSm2Quality,
  POINTS_PER_CORRECT,
  PERFECT_BONUS,
  type AnswerRecord,
} from '../lib/points'

function correct(hintNumber = 0): AnswerRecord {
  return { wasCorrect: true, hintNumber }
}
function wrong(hintNumber = 0): AnswerRecord {
  return { wasCorrect: false, hintNumber }
}

describe('calcQuizPoints', () => {
  it('CANONICAL: 10/10 with no hints === 125', () => {
    const answers = Array.from({ length: 10 }, () => correct(0))
    expect(calcQuizPoints(answers)).toBe(125)
  })

  it('returns 0 for an empty quiz', () => {
    expect(calcQuizPoints([])).toBe(0)
  })

  it('awards base points per correct answer with no perfect bonus when one is wrong', () => {
    // 9 correct (90) + 1 wrong (0), not perfect → 90
    const answers = [...Array.from({ length: 9 }, () => correct(0)), wrong(0)]
    expect(calcQuizPoints(answers)).toBe(90)
  })

  it('applies the documented hint deductions (1→2, 2→5, 3→10)', () => {
    expect(calcQuizPoints([correct(1)])).toBe(POINTS_PER_CORRECT - 2)
    expect(calcQuizPoints([correct(2)])).toBe(POINTS_PER_CORRECT - 5)
    expect(calcQuizPoints([correct(3)])).toBe(POINTS_PER_CORRECT - 10) // 0, never negative
  })

  it('never lets a single answer go negative even at max hint cost', () => {
    expect(calcQuizPoints([correct(3)])).toBeGreaterThanOrEqual(0)
  })

  it('forfeits the perfect bonus when any hint is used, even with full correctness', () => {
    const answers = [...Array.from({ length: 9 }, () => correct(0)), correct(1)]
    // 9*10 + (10-2) = 98, no perfect bonus
    expect(calcQuizPoints(answers)).toBe(98)
    expect(calcQuizPoints(answers)).toBeLessThan(100 + PERFECT_BONUS)
  })

  it('only awards the perfect bonus once, for a clean sweep', () => {
    const five = Array.from({ length: 5 }, () => correct(0))
    expect(calcQuizPoints(five)).toBe(5 * POINTS_PER_CORRECT + PERFECT_BONUS)
  })

  it('treats an unknown hint level as zero deduction (fail-safe)', () => {
    expect(calcQuizPoints([{ wasCorrect: true, hintNumber: 99 }])).toBe(POINTS_PER_CORRECT)
  })

  it('scores all-wrong as 0', () => {
    expect(calcQuizPoints(Array.from({ length: 10 }, () => wrong(0)))).toBe(0)
  })
})

describe('scoreToSm2Quality', () => {
  it('maps a flawless no-hint quiz to the top quality (5)', () => {
    expect(scoreToSm2Quality(1, 0)).toBe(5)
  })

  it('does NOT award 5 for a perfect score if hints were used', () => {
    expect(scoreToSm2Quality(1, 2)).toBe(4)
  })

  it('maps the documented score bands', () => {
    expect(scoreToSm2Quality(0.85, 1)).toBe(4)
    expect(scoreToSm2Quality(0.7, 0)).toBe(3)
    expect(scoreToSm2Quality(0.69, 0)).toBe(2)
    expect(scoreToSm2Quality(0, 0)).toBe(2)
  })

  it('keeps the SM-2 quality within the algorithm-valid 0–5 range', () => {
    for (const f of [0, 0.5, 0.7, 0.85, 1]) {
      const q = scoreToSm2Quality(f, 0)
      expect(q).toBeGreaterThanOrEqual(0)
      expect(q).toBeLessThanOrEqual(5)
    }
  })

  it('produces a quality >= 3 (a passing SM-2 grade) exactly when score >= 0.7', () => {
    // SM-2 resets the schedule below quality 3; 0.7 is the documented pass line.
    expect(scoreToSm2Quality(0.7, 1)).toBeGreaterThanOrEqual(3)
    expect(scoreToSm2Quality(0.69, 0)).toBeLessThan(3)
  })
})
