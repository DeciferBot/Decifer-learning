// Deterministic NL recommendations for the parent dashboard.
// No LLM call — derived from existing progress data.

type WeakArea = { topicTitle: string; errorRate: number; hintRate?: number }
type DigestSummary = { quizAttempts: number; activeDays: number; passRate: number | null; topicsCompleted: number; streakDays?: number }
type RecommendedLesson = { lessonTitle: string; subjectName: string } | null

export type ParentAction = {
  label: string   // short pill label e.g. "Revise Fractions"
  text: string    // 1–2 sentence NL recommendation
  urgency: 'high' | 'medium' | 'low'
}

export function buildParentActions(
  childName: string,
  weakAreas: WeakArea[],
  digest: DigestSummary | null,
  recommended: RecommendedLesson,
  streakDays: number,
): ParentAction[] {
  const actions: ParentAction[] = []

  // 1. Struggling topic action
  if (weakAreas.length > 0) {
    const worst = weakAreas[0]
    const pct = Math.round((1 - worst.errorRate) * 100)
    const hintNote = (worst.hintRate ?? 0) > 0.4
      ? ' They often need the third hint, so a quick chat or worked example before the next quiz might help.'
      : ''
    actions.push({
      label: `Revise ${worst.topicTitle}`,
      text: `${childName} is scoring around ${pct}% on ${worst.topicTitle}.${hintNote} Try doing the Learn page together before the next quiz attempt.`,
      urgency: pct < 50 ? 'high' : 'medium',
    })
  }

  // 2. Inactivity action
  if (digest && digest.activeDays === 0) {
    actions.push({
      label: 'Encourage a session',
      text: `${childName} hasn't been active this week. Even a 10-minute session keeps momentum going, and the Daily Challenge is a good low-pressure starting point.`,
      urgency: 'medium',
    })
  } else if (digest && digest.activeDays === 1 && digest.quizAttempts <= 1) {
    actions.push({
      label: 'Boost engagement',
      text: `${childName} had a light week, just ${digest.quizAttempts} quiz${digest.quizAttempts === 1 ? '' : 'zes'}. Checking in about their favourite topic can help rebuild momentum.`,
      urgency: 'low',
    })
  }

  // 3. Streak at risk
  if (streakDays >= 3 && (digest?.activeDays ?? 1) === 0) {
    actions.push({
      label: 'Protect streak',
      text: `${childName}'s ${streakDays}-day streak is at risk, and they haven't logged in this week. A quick reminder today keeps it alive.`,
      urgency: 'high',
    })
  }

  // 4. Next lesson nudge (only when child is active and no major weaknesses)
  if (recommended && weakAreas.length === 0 && digest && digest.activeDays > 0) {
    actions.push({
      label: `Next: ${recommended.subjectName}`,
      text: `${childName} is doing well! The next recommended topic is ${recommended.lessonTitle} in ${recommended.subjectName}. Let them know it's ready.`,
      urgency: 'low',
    })
  }

  // 5. Celebrate strong week
  if (digest && digest.passRate !== null && digest.passRate >= 80 && digest.quizAttempts >= 3) {
    actions.push({
      label: 'Great week!',
      text: `${childName} had a strong week, with ${digest.passRate}% pass rate across ${digest.quizAttempts} quizzes. Worth a mention at dinner!`,
      urgency: 'low',
    })
  }

  // Return at most 3 actions, highest urgency first
  const order = { high: 0, medium: 1, low: 2 }
  return actions.sort((a, b) => order[a.urgency] - order[b.urgency]).slice(0, 3)
}
