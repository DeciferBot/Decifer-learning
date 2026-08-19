/**
 * Deterministic option shuffling for the Skills Check.
 *
 * WHY SEEDED: the answer options must be in a different order for every child
 * (otherwise the correct answer sits in the same slot every time), but the SAME
 * order every time one child loads their own check. A plain Math.random() shuffle
 * reorders the options on every re-render and every page reload, which looks
 * broken and makes a half-finished answer meaningless.
 *
 * Seeding on (attempt token + question id) gives both properties at once, with
 * no shuffle state to store.
 *
 * PURE: no DB, no network, no Math.random().
 */

// The seeded PRNG itself lives in lib/seeded-random.ts, shared with the
// Reasoning Check. Re-exported here so existing imports keep working and so
// this file still reads as the one place to look for check shuffling.
export { hashSeed, seededRandom, seededShuffle } from '@/lib/seeded-random'

import { seededShuffle } from '@/lib/seeded-random'

/**
 * Build the answer options a child sees: the correct answer plus its distractors,
 * shuffled, with nothing marking which is which.
 *
 * Distractors arrive from `quiz_questions.distractors` as untyped JSON, so this
 * coerces defensively: anything that is not a usable string is dropped rather
 * than rendered as "[object Object]" or "null" in front of a child.
 *
 * Duplicates are removed. A distractor identical to the correct answer would
 * otherwise render two right answers, and marking would look arbitrary.
 */
export function buildOptions(
  correctAnswer: string,
  distractors: unknown,
  seed: string,
): string[] {
  const list = Array.isArray(distractors) ? distractors : []
  const cleaned = list
    .map((d) => (typeof d === 'string' ? d.trim() : typeof d === 'number' ? String(d) : ''))
    .filter((d) => d.length > 0)

  const seen = new Set([normaliseAnswer(correctAnswer)])
  const unique: string[] = []
  for (const d of cleaned) {
    const key = normaliseAnswer(d)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(d)
  }

  return seededShuffle([correctAnswer, ...unique], seed)
}

/**
 * Normalise an answer for comparison.
 *
 * Children type nothing here (every item is multiple choice), so this only has
 * to absorb whitespace and case differences between the stored answer and the
 * option string that comes back from the browser.
 */
export function normaliseAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True when the child's chosen option matches the stored correct answer. */
export function isCorrectAnswer(chosen: string | null | undefined, correct: string): boolean {
  if (!chosen) return false
  return normaliseAnswer(chosen) === normaliseAnswer(correct)
}
