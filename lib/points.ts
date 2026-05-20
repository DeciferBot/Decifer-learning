// Points calculation — source of truth for Phase 5 scoring.
// Verify: 10/10 no-hints quiz → calcQuizPoints(10×{wasCorrect:true,hintNumber:0}) === 125.

export const POINTS_PER_CORRECT = 10
export const PERFECT_BONUS = 25 // All correct, zero hints on any question

// Deduction from a correct answer's points based on highest hint level used.
const HINT_DEDUCTION: Record<number, number> = { 0: 0, 1: 2, 2: 5, 3: 10 }

export type AnswerRecord = { wasCorrect: boolean; hintNumber: number }

export function calcQuizPoints(answers: AnswerRecord[]): number {
  if (answers.length === 0) return 0
  let total = 0
  let perfect = true

  for (const { wasCorrect, hintNumber } of answers) {
    if (!wasCorrect) {
      perfect = false
      continue
    }
    if (hintNumber > 0) perfect = false
    const deduction = HINT_DEDUCTION[hintNumber] ?? 0
    total += Math.max(0, POINTS_PER_CORRECT - deduction)
  }

  if (perfect) total += PERFECT_BONUS
  return total
}

// Map a score fraction (0–1) and hints-used count to an SM-2 quality (0–5).
export function scoreToSm2Quality(scoreFraction: number, hintsUsed: number): number {
  if (scoreFraction >= 1 && hintsUsed === 0) return 5
  if (scoreFraction >= 0.85) return 4
  if (scoreFraction >= 0.7) return 3
  return 2
}
