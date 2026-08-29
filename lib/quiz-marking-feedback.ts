/**
 * Feedback a child reads after a written answer is marked.
 *
 * WHY THIS FILE EXISTS, AND WHY THE MODEL DOES NOT WRITE IT.
 *
 * app/api/quiz/mark/route.ts asks a model to mark a pupil's free-text answer.
 * It used to ask the model for the feedback sentence too, and send that
 * sentence straight to the child. Nothing read it in between. That is the
 * exact thing scripts/verify-content-safety.mjs check 7 exists to prevent, and
 * the check had been failing on that route.
 *
 * The marking still needs a model: deciding whether a nine-year-old's wording
 * conveys the same idea as the mark scheme is a judgement, and no amount of
 * string matching does it. What the model does NOT need to do is talk to the
 * child. So it now returns one thing, a list of criterion indices, which the
 * route bounds-checks against the rubric before anything else happens.
 *
 * Everything the child reads is built here, from the criteria a human wrote
 * into the question. The child's screen therefore contains only authored text,
 * whatever the model returns or how it fails.
 */

export type MarkingCriterion = {
  criterion: string
  marks: number
}

/**
 * The praise line. Indexed by how much of the rubric the pupil met, so a child
 * who got one of four marks is not told "perfect" and a child who got them all
 * is not told "good start".
 */
function opener(awarded: number, available: number): string {
  if (available <= 0) return 'Thanks for your answer.'
  const share = awarded / available
  if (share >= 1) return 'Full marks. You covered every part of this one.'
  if (share >= 0.67) return 'Really good answer. You got most of the way there.'
  if (share >= 0.34) return 'Good start. You have the main idea.'
  if (share > 0) return 'You have made a start, and one part is right.'
  return 'Not quite this time, and that is completely fine.'
}

/** Trim an authored criterion so it reads inside a sentence. */
function asPhrase(criterion: string): string {
  const clean = criterion.trim().replace(/\s+/g, ' ').replace(/[.]+$/, '')
  if (!clean) return ''
  return clean.charAt(0).toLowerCase() + clean.slice(1)
}

/**
 * Build the whole feedback string from the rubric and which parts were met.
 *
 * Deterministic: the same marking always produces the same words, which also
 * means this is testable, unlike a generated sentence.
 */
export function buildFeedback(
  criteria: MarkingCriterion[],
  criteriaMet: number[],
): string {
  const met = new Set(criteriaMet)
  const available = criteria.reduce((sum, c) => sum + (c.marks ?? 1), 0)
  const awarded = [...met].reduce((sum, i) => sum + (criteria[i]?.marks ?? 1), 0)

  const parts: string[] = [opener(awarded, available)]

  const gotRight = criteria
    .map((c, i) => (met.has(i) ? asPhrase(c.criterion) : ''))
    .filter(Boolean)

  if (gotRight.length === 1) {
    parts.push(`You got the mark for saying ${gotRight[0]}.`)
  } else if (gotRight.length > 1) {
    parts.push(`You picked up marks for ${gotRight.slice(0, -1).join(', ')} and ${gotRight[gotRight.length - 1]}.`)
  }

  // One thing to add, never a list of everything missed. A child who dropped
  // four marks does not need four corrections in a row.
  const firstMissed = criteria.findIndex((_, i) => !met.has(i))
  if (firstMissed !== -1) {
    const phrase = asPhrase(criteria[firstMissed].criterion)
    if (phrase) parts.push(`Next time, add ${phrase}.`)
  }

  return parts.join(' ')
}

/** Shown when the model call fails outright, so the child still gets a reply. */
export const MARKING_UNAVAILABLE_FEEDBACK =
  'We could not mark this one just now. Have a look at the model answer below, then try another question.'
