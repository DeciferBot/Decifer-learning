/**
 * Put a question's answers in an order that never changes.
 *
 * WHY THIS EXISTS. Every screen that shows answers used to shuffle them with
 * `Math.random()`. A page is drawn once on the server and again in the browser, and
 * a random shuffle gives a different order each time, so the two disagreed on every
 * question ever shown. With plain text answers nobody could tell: the buttons simply
 * settled into a different order than the one that arrived.
 *
 * It became visible the day answers became pictures. The browser kept the pictures
 * the server had sent but relabelled the buttons in its own order, so a button
 * showed one picture while carrying another's description — and when the answer was
 * revealed, the green "correct" mark landed on the wrong picture. Seen happening on
 * a real question, not imagined.
 *
 * The order is worked out from the question's own id, so the server and the browser
 * always reach the same answer, and a child sees one arrangement from first sight to
 * last instead of the buttons resettling under their finger.
 *
 * It has to be the id and not the answers: every picture question stores its answers
 * as the letters A to D, so an order derived from the answers would put the right one
 * in the same place on every picture question in the app.
 */

/** One well-mixed number per (question, position). */
function mix(seed: number, index: number): number {
  let t = (seed + (index + 1) * 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), 1 | t)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return (t ^ (t >>> 14)) >>> 0
}

function seedFrom(text: string): number {
  let seed = 0
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) | 0
  return seed
}

/** The answers to one question, in a settled order. Keeps every answer exactly once. */
export function stableChoiceOrder(
  questionId: string,
  correct: string,
  distractors: string[],
): string[] {
  const seed = seedFrom(questionId)
  return [correct, ...distractors]
    .map((value, i) => ({ value, rank: mix(seed, i) }))
    .sort((a, b) => a.rank - b.rank || a.value.localeCompare(b.value))
    .map((x) => x.value)
}
