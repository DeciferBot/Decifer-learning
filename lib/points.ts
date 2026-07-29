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

// ── Server-side answer verification ─────────────────────────────────────────
//
// The client sends wasCorrect with every answer, but a crafted POST can claim
// anything. Every route that scores a submission must re-check the child's
// answer against the stored correct_answer BEFORE it hands the log to
// scoreQuizAttempt, because that function scores what it is given.
//
// Multi-part types are the one exception: their answer lives in answer_parts
// rather than correct_answer, so a plain string comparison cannot judge them.
// For those we take the client's verdict, but only when the child actually
// supplied a non-empty answer, which stops a blank submission claiming a
// perfect score.

export const MULTIPART_TYPES = new Set([
  'true_false_grid',
  'ordered_list',
  'source_analysis',
  'explain_example',
  'structured_answer',
])

export type SubmittedAnswer = {
  questionId: string
  childAnswer: string
  wasCorrect: boolean
  hintNumber: number
  timeSeconds: number
}

// The answer key rows the caller loads from the database. The caller is
// responsible for scoping that query (status='published', right topic or zone).
// A question missing from the key is scored wrong, never correct.
export type AnswerKeyRow = {
  id: string
  correct_answer: string
  question_type: string
}

export function scoreAnswers(
  answers: SubmittedAnswer[],
  key: AnswerKeyRow[],
): SubmittedAnswer[] {
  const byId = new Map(key.map((q) => [q.id, q]))

  return answers.map((a) => {
    const question = byId.get(a.questionId)
    const given = typeof a.childAnswer === 'string' ? a.childAnswer.trim() : ''

    // Unknown, unpublished or out-of-scope question, or a blank answer → wrong.
    if (!question || given.length === 0) return { ...a, wasCorrect: false }

    return {
      ...a,
      wasCorrect: MULTIPART_TYPES.has(question.question_type)
        ? Boolean(a.wasCorrect)
        : question.correct_answer.trim().toLowerCase() === given.toLowerCase(),
    }
  })
}

// ── Quiz scoring ────────────────────────────────────────────────────────────
//
// A child gets up to 3 tries at a question and every try is logged. Scoring used
// to divide correct rows by TOTAL rows, so a wrong first try counted as a whole
// extra failed question and persistence pushed the score down. Replaying the 99
// attempts on record: 78 contained a retry, and 37 of them showed the child a
// passing result screen while the server recorded a fail.
//
// Credit falls with each try so knowing beats guessing. With four options and
// three tries, "correct if ever correct" would let a pure guesser average 75%,
// above the pass mark. At 1 / ⅔ / ⅓ a guesser averages 50%, while a child who
// knows the material and slips once still passes comfortably.
export const ATTEMPT_CREDIT = [1, 2 / 3, 1 / 3] as const

export const PASS_THRESHOLD = 0.7

export type ScoredAnswer = { questionId: string; wasCorrect: boolean; hintNumber: number }

export interface QuizScore {
  /** Distinct questions the child was asked. */
  totalQuestions: number
  /** Distinct questions answered correctly, whatever the try count. */
  correctCount: number
  /** Credit-weighted fraction in 0–1. */
  scoreFraction: number
  passed: boolean
  /** Distinct questions where a hint was used. */
  hintsUsedCount: number
  /** Every question right, first try, no hints. */
  perfectScore: boolean
}

/**
 * Score an answer log. The log is in the order the child answered, so repeated
 * entries for one question are its successive tries.
 *
 * PURE: no DB, no network, no AI. Callers must have already verified each
 * `wasCorrect` against the database before calling.
 */
export function scoreQuizAttempt(answers: ScoredAnswer[]): QuizScore {
  const byQuestion = new Map<string, { tries: number; correct: boolean; hintNumber: number }>()

  for (const a of answers) {
    const prev = byQuestion.get(a.questionId)
    if (!prev) {
      byQuestion.set(a.questionId, { tries: 1, correct: a.wasCorrect, hintNumber: a.hintNumber })
      continue
    }
    // Anything logged after a question was already answered correctly is ignored.
    if (prev.correct) continue
    prev.tries += 1
    prev.correct = a.wasCorrect
    prev.hintNumber = Math.max(prev.hintNumber, a.hintNumber)
  }

  const outcomes = Array.from(byQuestion.values())
  const totalQuestions = outcomes.length
  const correctCount = outcomes.filter((o) => o.correct).length
  const earned = outcomes.reduce(
    (sum, o) => sum + (o.correct ? ATTEMPT_CREDIT[Math.min(o.tries, ATTEMPT_CREDIT.length) - 1] : 0),
    0,
  )
  const scoreFraction = totalQuestions > 0 ? earned / totalQuestions : 0
  const hintsUsedCount = outcomes.filter((o) => o.hintNumber > 0).length

  return {
    totalQuestions,
    correctCount,
    scoreFraction,
    passed: scoreFraction >= PASS_THRESHOLD,
    hintsUsedCount,
    perfectScore:
      totalQuestions > 0 && outcomes.every((o) => o.correct && o.tries === 1) && hintsUsedCount === 0,
  }
}

// Map a score fraction (0–1) and hints-used count to an SM-2 quality (0–5).
export function scoreToSm2Quality(scoreFraction: number, hintsUsed: number): number {
  if (scoreFraction >= 1 && hintsUsed === 0) return 5
  if (scoreFraction >= 0.85) return 4
  if (scoreFraction >= 0.7) return 3
  return 2
}
