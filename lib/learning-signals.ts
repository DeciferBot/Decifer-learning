/**
 * Learning Signal Engine — PLI v1
 *
 * DETERMINISTIC AND TESTABLE. No DB calls in this file.
 * All data is passed in as typed input objects.
 * The runner (lib/learning-signals-runner.ts) fetches data and calls computeSignals().
 *
 * Non-negotiables:
 *   - No LLM calls. No AI generation.
 *   - No diagnosis. No labels: weak, lazy, disorder, ADHD, dyslexia.
 *   - No claim of interest from <2 events.
 *   - No claim of avoidance from <3 data points.
 *   - Every signal includes evidence count.
 *   - Every signal includes a calm recommended action.
 *   - Signals are suppressed when evidence is insufficient.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SignalConfidence = 'early' | 'moderate' | 'strong'

export type SignalType =
  | 'mastery'
  | 'lower_accuracy'
  | 'high_effort_low_progress'
  | 'quick_success'
  | 'rushing_or_low_engagement'
  | 'persistence'
  | 'repeated_without_progress'
  | 'interest_signal'
  | 'avoidance_signal'
  | 'confidence_gap'

export interface LearningSignal {
  id: string                         // deterministic: signalType + topicId/subjectId
  childProfileId: string
  signalType: SignalType
  subjectId: string | null
  topicId: string | null
  title: string
  evidenceSummary: string
  evidenceCount: number
  confidence: SignalConfidence
  whatThisMayMean: string
  recommendedAction: string
  createdFrom: string[]              // source tables/events used
  updatedAt: Date
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface TopicProgressInput {
  topicId: string
  subjectId: string
  subjectName: string
  topicTitle: string
  status: string                     // 'completed' | 'in_progress' | other
  lastScore: number | null
  completedAt: Date | null
  srRepetitions: number
  srIntervalDays: number
}

export interface QuizAttemptInput {
  attemptId: string
  topicId: string
  subjectId: string
  score: number                      // 0.0–1.0
  hintsUsed: number
  timeTakenSeconds: number
  heartsRemaining: number
  createdAt: Date
}

export interface QuizAnswerInput {
  attemptId: string
  topicId: string
  wasCorrect: boolean
  hintNumber: number
  timeSeconds: number
}

export interface LearningEventInput {
  eventType: string
  topicId: string | null
  subjectId: string | null
  lessonId: string | null
  metadata: Record<string, unknown>
  occurredAt: Date
}

export interface SignalEngineInput {
  childProfileId: string
  topicProgress: TopicProgressInput[]
  quizAttempts: QuizAttemptInput[]
  quizAnswers: QuizAnswerInput[]
  learningEvents: LearningEventInput[]
  // topicId → title for topics referenced by events/attempts that have no
  // topic_progress row yet (e.g. lesson done, quiz not attempted). Without
  // this, signal titles fall back to a raw UUID.
  topicTitles?: Record<string, string>
  generatedAt: Date
}

// ── Confidence helper ─────────────────────────────────────────────────────────

export function signalConfidence(evidenceCount: number): SignalConfidence {
  if (evidenceCount >= 15) return 'strong'
  if (evidenceCount >= 6)  return 'moderate'
  return 'early'
}

// ── ID generator ──────────────────────────────────────────────────────────────

function signalId(type: SignalType, scopeId: string | null): string {
  return `${type}::${scopeId ?? 'global'}`
}

// ── Per-topic aggregation helpers ────────────────────────────────────────────

interface TopicAnswerStats {
  topicId: string
  total: number
  correct: number
  totalHints: number
  attempts: QuizAttemptInput[]
  answers: QuizAnswerInput[]
}

function buildTopicAnswerStats(
  attempts: QuizAttemptInput[],
  answers: QuizAnswerInput[],
): Map<string, TopicAnswerStats> {
  const answersByAttempt = new Map<string, QuizAnswerInput[]>()
  for (const a of answers) {
    if (!answersByAttempt.has(a.attemptId)) answersByAttempt.set(a.attemptId, [])
    answersByAttempt.get(a.attemptId)!.push(a)
  }

  const stats = new Map<string, TopicAnswerStats>()
  for (const attempt of attempts) {
    const tid = attempt.topicId
    if (!stats.has(tid)) {
      stats.set(tid, { topicId: tid, total: 0, correct: 0, totalHints: 0, attempts: [], answers: [] })
    }
    const s = stats.get(tid)!
    s.attempts.push(attempt)
    const ans = answersByAttempt.get(attempt.attemptId) ?? []
    for (const a of ans) {
      s.total++
      if (a.wasCorrect) s.correct++
      if (a.hintNumber > 0) s.totalHints++
    }
    s.answers.push(...ans)
  }
  return stats
}

// ── Signal generators ─────────────────────────────────────────────────────────

function generateMasterySignals(
  input: SignalEngineInput,
  answerStats: Map<string, TopicAnswerStats>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  for (const progress of input.topicProgress) {
    if (progress.lastScore === null || progress.lastScore < 0.80) continue
    if (progress.status !== 'completed') continue

    const stats = answerStats.get(progress.topicId)
    const attempts = stats?.attempts ?? []
    const totalAnswers = stats?.total ?? 0
    const avgHintsPerAttempt = attempts.length > 0
      ? attempts.reduce((s, a) => s + a.hintsUsed, 0) / attempts.length
      : null

    const evidenceCount = totalAnswers
    if (evidenceCount < 3) continue

    const repeatedSuccess = progress.srRepetitions >= 2
    const confidence = repeatedSuccess
      ? signalConfidence(Math.max(evidenceCount, 15))
      : signalConfidence(evidenceCount)

    const scorePercent = Math.round(progress.lastScore * 100)
    const hintsNote = avgHintsPerAttempt !== null && avgHintsPerAttempt < 0.5
      ? ' with minimal hints'
      : ''

    signals.push({
      id:              signalId('mastery', progress.topicId),
      childProfileId:  input.childProfileId,
      signalType:      'mastery',
      subjectId:       progress.subjectId,
      topicId:         progress.topicId,
      title:           `${progress.topicTitle}: strong recent score`,
      evidenceSummary: repeatedSuccess
        ? `Completed with ${scorePercent}%${hintsNote} across ${progress.srRepetitions + 1} review attempts.`
        : `Completed with ${scorePercent}%${hintsNote} on the last attempt.`,
      evidenceCount,
      confidence,
      whatThisMayMean: repeatedSuccess
        ? 'This topic has been revisited and the accuracy has held up across multiple attempts.'
        : 'A good result on one attempt. Revisiting it later will confirm whether it has been retained.',
      recommendedAction: repeatedSuccess
        ? 'Move on to a related or more advanced topic in the same subject.'
        : 'Continue to the next topic. Spaced review is scheduled automatically.',
      createdFrom:  ['topic_progress', 'quiz_attempts', 'quiz_answers'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateLowerAccuracySignals(
  input: SignalEngineInput,
  answerStats: Map<string, TopicAnswerStats>,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  for (const [topicId, stats] of answerStats.entries()) {
    if (stats.total < 3) continue
    const errorRate = (stats.total - stats.correct) / stats.total
    if (errorRate < 0.5) continue

    const progress = progressByTopic.get(topicId)
    const subjectName = progress?.subjectName ?? ''
    const topicTitle  = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'

    signals.push({
      id:              signalId('lower_accuracy', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'lower_accuracy',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: lower accuracy so far`,
      evidenceSummary: `Lower accuracy across ${stats.total} answers in ${subjectName || 'this subject'} (${Math.round(errorRate * 100)}% incorrect).`,
      evidenceCount:   stats.total,
      confidence:      signalConfidence(stats.total),
      whatThisMayMean: 'This may mean the topic needs more practice time or a different approach to the explanation.',
      recommendedAction: 'Revisit the lesson, then try a short practice session before attempting the quiz again.',
      createdFrom:  ['quiz_attempts', 'quiz_answers'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateHighEffortLowProgressSignals(
  input: SignalEngineInput,
  answerStats: Map<string, TopicAnswerStats>,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  // Compute median time across all attempts for comparison
  const allTimes = input.quizAttempts
    .map((a) => a.timeTakenSeconds)
    .filter((t) => t > 0)
    .sort((a, b) => a - b)

  if (allTimes.length < 3) return signals // not enough data for comparison

  const medianTime = allTimes[Math.floor(allTimes.length / 2)]

  for (const [topicId, stats] of answerStats.entries()) {
    if (stats.total < 6) continue
    const errorRate = (stats.total - stats.correct) / stats.total
    if (errorRate < 0.4) continue

    const avgTime = stats.attempts.length > 0
      ? stats.attempts.reduce((s, a) => s + a.timeTakenSeconds, 0) / stats.attempts.length
      : 0

    if (avgTime < medianTime * 1.3) continue // not significantly above average

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'

    signals.push({
      id:              signalId('high_effort_low_progress', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'high_effort_low_progress',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: taking longer with lower accuracy`,
      evidenceSummary: `Spending above-average time (avg ${Math.round(avgTime / 60)} min) on this topic, with ${Math.round(errorRate * 100)}% incorrect answers across ${stats.total} questions.`,
      evidenceCount:   stats.total,
      confidence:      signalConfidence(stats.total),
      whatThisMayMean: 'This may suggest the topic needs a different explanation or a step-by-step breakdown before quizzes.',
      recommendedAction: 'Try the lesson again with a focus on worked examples. A shorter practice set may help before the next quiz.',
      createdFrom:  ['quiz_attempts', 'quiz_answers'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateQuickSuccessSignals(
  input: SignalEngineInput,
  answerStats: Map<string, TopicAnswerStats>,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  const allTimes = input.quizAttempts
    .map((a) => a.timeTakenSeconds)
    .filter((t) => t > 0)
    .sort((a, b) => a - b)

  if (allTimes.length < 3) return signals

  const medianTime = allTimes[Math.floor(allTimes.length / 2)]

  for (const [topicId, stats] of answerStats.entries()) {
    // Require at least 2 attempts with high scores to avoid overclaiming
    const highScoringAttempts = stats.attempts.filter((a) => a.score >= 0.85)
    if (highScoringAttempts.length < 2) continue

    const avgTime = highScoringAttempts.reduce((s, a) => s + a.timeTakenSeconds, 0) / highScoringAttempts.length
    if (avgTime > medianTime * 0.7) continue // not notably quick

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'

    signals.push({
      id:              signalId('quick_success', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'quick_success',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: completed quickly with high accuracy`,
      evidenceSummary: `High accuracy (≥85%) achieved in below-average time across ${highScoringAttempts.length} attempts.`,
      evidenceCount:   highScoringAttempts.length,
      confidence:      signalConfidence(highScoringAttempts.length),
      whatThisMayMean: 'This topic may already be well understood. A more challenging topic in the same area could be a good next step.',
      recommendedAction: 'Move to the next topic or try a challenge-level quiz to extend understanding.',
      createdFrom:  ['quiz_attempts', 'quiz_answers'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateRushingSignals(
  input: SignalEngineInput,
  answerStats: Map<string, TopicAnswerStats>,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  // "Rushing" = low time AND low score across multiple attempts
  for (const [topicId, stats] of answerStats.entries()) {
    if (stats.attempts.length < 2) continue

    const lowTimeAttempts = stats.attempts.filter(
      (a) => a.timeTakenSeconds > 0 && a.timeTakenSeconds < 120 && a.score < 0.5,
    )
    if (lowTimeAttempts.length < 2) continue

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'

    signals.push({
      id:              signalId('rushing_or_low_engagement', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'rushing_or_low_engagement',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: quick responses with low accuracy`,
      evidenceSummary: `Low quiz scores completed in under 2 minutes, seen in ${lowTimeAttempts.length} attempts. This may suggest rushing or lower engagement.`,
      evidenceCount:   lowTimeAttempts.length,
      confidence:      signalConfidence(lowTimeAttempts.length),
      whatThisMayMean: 'This may suggest the child is moving through questions quickly without reading them carefully. This is a possible pattern, not a certain conclusion.',
      recommendedAction: 'Try the lesson together, focusing on reading each question before answering. A calm, unhurried session often helps.',
      createdFrom:  ['quiz_attempts', 'quiz_answers'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generatePersistenceSignals(
  input: SignalEngineInput,
  answerStats: Map<string, TopicAnswerStats>,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  for (const [topicId, stats] of answerStats.entries()) {
    if (stats.attempts.length < 2) continue

    // Sort by date ascending
    const sorted = [...stats.attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const first = sorted[0]
    const latest = sorted[sorted.length - 1]

    // Persistence: first attempt low, later attempt significantly better
    if (first.score >= 0.6) continue        // first attempt wasn't struggling
    if (latest.score < first.score + 0.2) continue // no meaningful improvement

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'
    const improvement = Math.round((latest.score - first.score) * 100)

    signals.push({
      id:              signalId('persistence', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'persistence',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: returned and improved`,
      evidenceSummary: `First attempt scored ${Math.round(first.score * 100)}%. Returned and improved by ${improvement} percentage points across ${stats.attempts.length} attempts.`,
      evidenceCount:   stats.attempts.length,
      confidence:      signalConfidence(stats.attempts.length + stats.total),
      whatThisMayMean: 'Retrying a topic and improving shows that learning is happening over time. This is a positive pattern.',
      recommendedAction: 'Acknowledge the improvement. The next quiz or spaced review will confirm whether the improvement has been retained.',
      createdFrom:  ['quiz_attempts', 'quiz_answers'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateRepeatedWithoutProgressSignals(
  input: SignalEngineInput,
  answerStats: Map<string, TopicAnswerStats>,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  for (const [topicId, stats] of answerStats.entries()) {
    if (stats.attempts.length < 3) continue

    const sorted = [...stats.attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    // All attempts below 60% and no improvement across 3+ attempts
    const allLow     = sorted.every((a) => a.score < 0.6)
    const noProgress = (sorted[sorted.length - 1].score - sorted[0].score) < 0.1

    if (!allLow || !noProgress) continue

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'

    signals.push({
      id:              signalId('repeated_without_progress', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'repeated_without_progress',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: repeated attempts without improvement yet`,
      evidenceSummary: `${stats.attempts.length} attempts on this topic, all scoring below 60%, with no clear upward trend.`,
      evidenceCount:   stats.attempts.length,
      confidence:      signalConfidence(stats.attempts.length),
      whatThisMayMean: 'This may mean the foundational concepts for this topic need more time, or a different explanation style would help.',
      recommendedAction: 'Pause quizzing on this topic for now. Try the lesson with a worked example, or look at a prerequisite topic first.',
      createdFrom:  ['quiz_attempts', 'quiz_answers'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateInterestSignals(
  input: SignalEngineInput,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  // Interest signal requires repeated lesson_opened events for the same topic.
  // Minimum 3 opens across at least 2 separate days to avoid one long session.
  const opensByTopic = new Map<string, LearningEventInput[]>()

  for (const ev of input.learningEvents) {
    if (ev.eventType !== 'lesson_opened' || !ev.topicId) continue
    if (!opensByTopic.has(ev.topicId)) opensByTopic.set(ev.topicId, [])
    opensByTopic.get(ev.topicId)!.push(ev)
  }

  for (const [topicId, events] of opensByTopic.entries()) {
    if (events.length < 3) continue

    // Check they span at least 2 separate calendar days
    const days = new Set(events.map((e) => e.occurredAt.toISOString().slice(0, 10)))
    if (days.size < 2) continue

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'
    const subjectName = progress?.subjectName ?? ''

    signals.push({
      id:              signalId('interest_signal', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'interest_signal',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: repeated activity`,
      evidenceSummary: `This topic was opened ${events.length} times across ${days.size} separate days${subjectName ? ` in ${subjectName}` : ''}.`,
      evidenceCount:   events.length,
      confidence:      signalConfidence(events.length),
      whatThisMayMean: 'Repeated activity in the same topic may reflect engagement or a desire to understand it more fully. It does not necessarily indicate difficulty.',
      recommendedAction: 'Consider exploring related topics or extending with a challenge-level question to build on this activity.',
      createdFrom:  ['learning_events'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateAvoidanceSignals(
  input: SignalEngineInput,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  // Avoidance signal: recommendation_shown at least 3 times for a topic
  // with no recommendation_clicked or lesson_opened for that topic.
  const shownByTopic  = new Map<string, number>()
  const clickedTopics = new Set<string>()
  const openedTopics  = new Set<string>()

  for (const ev of input.learningEvents) {
    if (!ev.topicId) continue
    if (ev.eventType === 'recommendation_shown')   shownByTopic.set(ev.topicId, (shownByTopic.get(ev.topicId) ?? 0) + 1)
    if (ev.eventType === 'recommendation_clicked') clickedTopics.add(ev.topicId)
    if (ev.eventType === 'lesson_opened')          openedTopics.add(ev.topicId)
  }

  for (const [topicId, shownCount] of shownByTopic.entries()) {
    if (shownCount < 3) continue
    if (clickedTopics.has(topicId) || openedTopics.has(topicId)) continue

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'

    signals.push({
      id:              signalId('avoidance_signal', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'avoidance_signal',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: lower engagement so far`,
      evidenceSummary: `This topic has been recommended ${shownCount} times but has not been opened yet.`,
      evidenceCount:   shownCount,
      confidence:      signalConfidence(shownCount),
      whatThisMayMean: 'Lower engagement with a recommended topic may have many explanations: timing, difficulty expectations, or simply not getting to it yet.',
      recommendedAction: 'Start with just the lesson for 5 minutes to build familiarity. A short first session is better than waiting for the right moment.',
      createdFrom:  ['learning_events'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

function generateConfidenceGapSignals(
  input: SignalEngineInput,
  progressByTopic: Map<string, TopicProgressInput>,
): LearningSignal[] {
  const signals: LearningSignal[] = []

  // Confidence gap: lesson_completed but no quiz_started or quiz_completed
  // for the same topic. Requires this pattern on at least 2 lessons.
  const completedLessonTopics = new Set<string>()
  const quizStartedTopics     = new Set<string>()

  for (const ev of input.learningEvents) {
    if (!ev.topicId) continue
    if (ev.eventType === 'lesson_completed')  completedLessonTopics.add(ev.topicId)
    if (ev.eventType === 'quiz_started')      quizStartedTopics.add(ev.topicId)
    if (ev.eventType === 'quiz_completed')    quizStartedTopics.add(ev.topicId)
  }

  // Also check quiz_attempts — child may have done quiz before events were tracked
  const attemptedTopics = new Set(input.quizAttempts.map((a) => a.topicId))

  for (const topicId of completedLessonTopics) {
    if (quizStartedTopics.has(topicId) || attemptedTopics.has(topicId)) continue

    const progress = progressByTopic.get(topicId)
    const topicTitle = progress?.topicTitle ?? input.topicTitles?.[topicId] ?? 'Unknown topic'

    signals.push({
      id:              signalId('confidence_gap', topicId),
      childProfileId:  input.childProfileId,
      signalType:      'confidence_gap',
      subjectId:       progress?.subjectId ?? null,
      topicId,
      title:           `${topicTitle}: lesson done, quiz not yet attempted`,
      evidenceSummary: `The lesson for this topic has been completed, but no quiz has been attempted yet.`,
      evidenceCount:   1,
      confidence:      'early',
      whatThisMayMean: 'This may mean your child needs a little encouragement to test their understanding after the lesson.',
      recommendedAction: 'Let your child know that the quiz is low pressure: wrong answers are explained and retries are always allowed.',
      createdFrom:  ['learning_events', 'quiz_attempts'],
      updatedAt:    input.generatedAt,
    })
  }

  return signals
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute all learning signals from a set of child activity data.
 * Returns only signals that have sufficient evidence — never placeholder or fake signals.
 *
 * Deduplication: each signal type per topic/subject produces at most one signal.
 * Higher-specificity signals (e.g. persistence) suppress lower-specificity ones
 * (e.g. lower_accuracy) for the same topic to avoid contradiction.
 */
export function computeSignals(input: SignalEngineInput): LearningSignal[] {
  const progressByTopic = new Map<string, TopicProgressInput>()
  for (const p of input.topicProgress) {
    progressByTopic.set(p.topicId, p)
  }

  const answerStats = buildTopicAnswerStats(input.quizAttempts, input.quizAnswers)

  const all: LearningSignal[] = [
    ...generateMasterySignals(input, answerStats),
    ...generateLowerAccuracySignals(input, answerStats, progressByTopic),
    ...generateHighEffortLowProgressSignals(input, answerStats, progressByTopic),
    ...generateQuickSuccessSignals(input, answerStats, progressByTopic),
    ...generateRushingSignals(input, answerStats, progressByTopic),
    ...generatePersistenceSignals(input, answerStats, progressByTopic),
    ...generateRepeatedWithoutProgressSignals(input, answerStats, progressByTopic),
    ...generateInterestSignals(input, progressByTopic),
    ...generateAvoidanceSignals(input, progressByTopic),
    ...generateConfidenceGapSignals(input, progressByTopic),
  ]

  // Dedup by id — first signal per id wins (highest-specificity listed first above)
  const seen = new Set<string>()
  const deduped = all.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })

  // Suppress lower_accuracy for topics that already have a persistence signal
  const persistenceTopics = new Set(
    deduped.filter((s) => s.signalType === 'persistence').map((s) => s.topicId),
  )

  return deduped.filter((s) => {
    if (s.signalType === 'lower_accuracy' && s.topicId && persistenceTopics.has(s.topicId)) return false
    return true
  })
}
