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
  scoreQuizAttempt,
  POINTS_PER_CORRECT,
  PERFECT_BONUS,
  PASS_THRESHOLD,
  type AnswerRecord,
  type ScoredAnswer,
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

// ── scoreQuizAttempt ────────────────────────────────────────────────────────
//
// The bug this replaced: the score divided correct answer ROWS by TOTAL rows, so
// a child who got a question right on their second try was scored 1 out of 2 for
// it. Across the 99 attempts on record, 78 contained a retry and 37 showed the
// child a passing result screen while the server recorded a fail.

function ans(questionId: string, wasCorrect: boolean, hintNumber = 0): ScoredAnswer {
  return { questionId, wasCorrect, hintNumber }
}

/** 10 distinct questions, all right first try, no hints. */
function tenPerfect(): ScoredAnswer[] {
  return Array.from({ length: 10 }, (_, i) => ans(`q${i}`, true))
}

describe('scoreQuizAttempt', () => {
  it('scores a clean 10/10 as 100% and perfect', () => {
    const s = scoreQuizAttempt(tenPerfect())
    expect(s.totalQuestions).toBe(10)
    expect(s.correctCount).toBe(10)
    expect(s.scoreFraction).toBe(1)
    expect(s.passed).toBe(true)
    expect(s.perfectScore).toBe(true)
  })

  it('counts a retried question ONCE, not as an extra failed question', () => {
    // Wrong then right on q0. The old rule scored this 1/2 for that question.
    const s = scoreQuizAttempt([ans('q0', false), ans('q0', true)])
    expect(s.totalQuestions).toBe(1)
    expect(s.correctCount).toBe(1)
    expect(s.scoreFraction).toBeCloseTo(2 / 3, 5)
  })

  it('gives less credit for each extra try', () => {
    const first = scoreQuizAttempt([ans('q0', true)])
    const second = scoreQuizAttempt([ans('q0', false), ans('q0', true)])
    const third = scoreQuizAttempt([ans('q0', false), ans('q0', false), ans('q0', true)])

    expect(first.scoreFraction).toBe(1)
    expect(second.scoreFraction).toBeCloseTo(2 / 3, 5)
    expect(third.scoreFraction).toBeCloseTo(1 / 3, 5)
  })

  it('gives no credit for a question the child never got right', () => {
    const s = scoreQuizAttempt([ans('q0', false), ans('q0', false), ans('q0', false)])
    expect(s.correctCount).toBe(0)
    expect(s.scoreFraction).toBe(0)
    expect(s.passed).toBe(false)
  })

  it('passes a child who knows the material and slips on one question', () => {
    // 9 right first try, 1 right on the second try → (9 + 2/3) / 10.
    const answers = [...tenPerfect().slice(0, 9), ans('q9', false), ans('q9', true)]
    const s = scoreQuizAttempt(answers)
    expect(s.scoreFraction).toBeCloseTo(9.6667 / 10, 3)
    expect(s.passed).toBe(true)
  })

  it('fails a pure guesser: four options and three tries averages 50%, under the pass mark', () => {
    // The expected credit for random guessing is 0.25(1 + 2/3 + 1/3) = 0.5.
    // Modelled here as the exact even split of the four outcomes over 8 questions.
    const answers: ScoredAnswer[] = []
    // 2 right first try, 2 right second, 2 right third, 2 never right.
    answers.push(ans('a1', true), ans('a2', true))
    answers.push(ans('b1', false), ans('b1', true), ans('b2', false), ans('b2', true))
    answers.push(ans('c1', false), ans('c1', false), ans('c1', true))
    answers.push(ans('c2', false), ans('c2', false), ans('c2', true))
    answers.push(ans('d1', false), ans('d1', false), ans('d1', false))
    answers.push(ans('d2', false), ans('d2', false), ans('d2', false))

    const s = scoreQuizAttempt(answers)
    expect(s.totalQuestions).toBe(8)
    expect(s.scoreFraction).toBeCloseTo(0.5, 5)
    expect(s.passed).toBe(false)
    expect(s.scoreFraction).toBeLessThan(PASS_THRESHOLD)
  })

  it('is not perfect when a hint was used, even with every answer right', () => {
    const answers = [...tenPerfect().slice(0, 9), ans('q9', true, 1)]
    const s = scoreQuizAttempt(answers)
    expect(s.correctCount).toBe(10)
    expect(s.scoreFraction).toBe(1)
    expect(s.hintsUsedCount).toBe(1)
    expect(s.perfectScore).toBe(false)
  })

  it('is not perfect when a question needed a second try', () => {
    const answers = [...tenPerfect().slice(0, 9), ans('q9', false), ans('q9', true)]
    expect(scoreQuizAttempt(answers).perfectScore).toBe(false)
  })

  it('keeps the highest hint level used across tries on one question', () => {
    const s = scoreQuizAttempt([ans('q0', false, 2), ans('q0', true, 0)])
    expect(s.hintsUsedCount).toBe(1)
  })

  it('ignores anything logged after a question was already answered correctly', () => {
    const s = scoreQuizAttempt([ans('q0', true), ans('q0', false)])
    expect(s.correctCount).toBe(1)
    expect(s.scoreFraction).toBe(1)
  })

  it('returns a safe zero for an empty log rather than NaN', () => {
    const s = scoreQuizAttempt([])
    expect(s.totalQuestions).toBe(0)
    expect(s.scoreFraction).toBe(0)
    expect(s.passed).toBe(false)
    expect(s.perfectScore).toBe(false)
  })

  it('passes exactly at the 70% threshold, not just above it', () => {
    // 7 right first try out of 10 → 0.7 exactly.
    const answers = [
      ...Array.from({ length: 7 }, (_, i) => ans(`q${i}`, true)),
      ...Array.from({ length: 3 }, (_, i) => ans(`w${i}`, false)),
    ]
    const s = scoreQuizAttempt(answers)
    expect(s.scoreFraction).toBeCloseTo(0.7, 5)
    expect(s.passed).toBe(true)
  })
})
