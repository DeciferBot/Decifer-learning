// Speech-bubble lines for the study buddy in the quiz loop (components/quiz/
// StudyBuddy.tsx). Every pool is deliberately:
//   - process-praise, not person-praise ("you worked that out" not "you're so
//     clever") — praising the strategy holds up under a harder question next
//     time; praising the child's cleverness does not (Dweck/Mueller).
//   - not inflated ("Nice one" not "INCREDIBLE!!!") — intensifiers measurably
//     backfire for exactly the children a learning app needs to reach
//     (Brummelman). See docs/research/WRITING_FOR_CHILDREN_STANDARDS_2026-08.md.
//   - varied — the same line landing five times in one round reads as a
//     recording, not a companion (copy audit finding: static praise).
//   - gain-framed, never a verdict on the child — a miss is answered with
//     what to try, never "wrong".

export type BuddyMood = 'idle' | 'happy' | 'excited' | 'oops' | 'anticipation'

/** Pick a line without repeating whatever was shown last, when the pool allows it. */
export function pickLine(pool: readonly string[], avoid?: string): string {
  if (pool.length <= 1) return pool[0] ?? ''
  const options = pool.filter((line) => line !== avoid)
  return options[Math.floor(Math.random() * options.length)] ?? pool[0]
}

// First-attempt correct, no hints used — the strongest moment, praise the method.
export const CORRECT_FIRST_TRY = [
  'You worked that one out!',
  'Straight to it — nice.',
  'That was quick thinking.',
  'You spotted it right away.',
  'Nailed it, first go.',
] as const

// Correct after a retry or a hint — praise the persistence, not just the result.
export const CORRECT_WITH_HELP = [
  'You got there!',
  'See, you found it.',
  'That hint did the job.',
  'Stuck with it — good.',
] as const

// Wrong answer, attempts remain — short, blame-free, forward-looking.
export const TRY_AGAIN = [
  'Ooh, close. Have another go.',
  "Not that one — you'll get it.",
  'Try a different one.',
  'Have another look.',
] as const

// Three hintless correct answers in a row.
export const COMBO = [
  "You're on a roll!",
  'Three in a row!',
  "You're flying through these!",
] as const

// Entering the final question of the round.
export const LAST_QUESTION = [
  'Last one — you can do this!',
  "One more and you're done!",
  'Final question, go for it!',
] as const

export const IDLE = [
  "Let's do this one.",
  'Take your time.',
] as const
