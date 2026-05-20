// SM-2 spaced repetition algorithm — exact spec from CLAUDE.md §10.
// quality: 0–5. reps/easiness/interval: current SM-2 state from topic_progress + profiles.
export function sm2(quality: number, reps: number, easiness: number, interval: number) {
  if (quality < 3) return { reps: 0, easiness, interval: 1 }
  const e = Math.max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  const r = reps + 1
  const i = r === 1 ? 1 : r === 2 ? 6 : Math.round(interval * e)
  return { reps: r, easiness: e, interval: i }
}
