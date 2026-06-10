/**
 * Learning Signals Runner — PLI v1
 *
 * Fetches all required data from the DB and feeds it into the pure signal engine.
 * Separated so the engine (lib/learning-signals.ts) remains unit-testable without DB.
 */

import { prisma } from './prisma'
import { getLearningEventsForChild } from './learning-events'
import {
  computeSignals,
  type LearningSignal,
  type SignalEngineInput,
  type TopicProgressInput,
  type QuizAttemptInput,
  type QuizAnswerInput,
  type LearningEventInput,
} from './learning-signals'

/**
 * Fetch all signal inputs for a child and run the signal engine.
 * Returns a sorted list of signals, most actionable first.
 * Returns [] if insufficient data exists — never throws.
 */
export async function getSignalsForChild(childProfileId: string): Promise<LearningSignal[]> {
  try {
    const [progressRows, attemptRows, eventRows] = await Promise.all([
      prisma.topicProgress.findMany({
        where:   { profile_id: childProfileId },
        include: { topic: { include: { subject: true } } },
      }),
      prisma.quizAttempt.findMany({
        where:   { profile_id: childProfileId },
        include: {
          topic:   { select: { subject_id: true } },
          answers: true,
        },
        orderBy: { created_at: 'asc' },
      }),
      getLearningEventsForChild(childProfileId, { limit: 500 }),
    ])

    const topicProgress: TopicProgressInput[] = progressRows.map((r) => ({
      topicId:       r.topic_id,
      subjectId:     r.topic.subject_id,
      subjectName:   r.topic.subject.name,
      topicTitle:    r.topic.title,
      status:        r.status,
      lastScore:     r.last_score,
      completedAt:   r.completed_at,
      srRepetitions: r.sr_repetitions,
      srIntervalDays: r.sr_interval_days,
    }))

    const quizAttempts: QuizAttemptInput[] = attemptRows.map((a) => ({
      attemptId:        a.id,
      topicId:          a.topic_id,
      subjectId:        a.topic.subject_id,
      score:            a.score,
      hintsUsed:        a.hints_used,
      timeTakenSeconds: a.time_taken_seconds,
      heartsRemaining:  a.hearts_remaining,
      createdAt:        a.created_at,
    }))

    const quizAnswers: QuizAnswerInput[] = attemptRows.flatMap((a) =>
      a.answers.map((ans) => ({
        attemptId:   a.id,
        topicId:     a.topic_id,
        wasCorrect:  ans.was_correct,
        hintNumber:  ans.hint_number,
        timeSeconds: ans.time_seconds,
      })),
    )

    const learningEvents: LearningEventInput[] = eventRows.map((e) => ({
      eventType:  e.eventType,
      topicId:    e.topicId,
      subjectId:  e.subjectId,
      lessonId:   e.lessonId,
      metadata:   e.metadata,
      occurredAt: e.occurredAt,
    }))

    // Titles for topics referenced by events/attempts that have no
    // topic_progress row yet — otherwise signal titles show a raw UUID.
    const knownTopicIds = new Set(topicProgress.map((p) => p.topicId))
    const orphanTopicIds = [
      ...new Set(
        [...learningEvents.map((e) => e.topicId), ...quizAttempts.map((a) => a.topicId)]
          .filter((id): id is string => !!id && !knownTopicIds.has(id)),
      ),
    ]
    const topicTitles: Record<string, string> = {}
    if (orphanTopicIds.length > 0) {
      const titleRows = await prisma.topic.findMany({
        where:  { id: { in: orphanTopicIds } },
        select: { id: true, title: true },
      })
      for (const t of titleRows) topicTitles[t.id] = t.title
    }

    const input: SignalEngineInput = {
      childProfileId,
      topicProgress,
      quizAttempts,
      quizAnswers,
      learningEvents,
      topicTitles,
      generatedAt: new Date(),
    }

    const signals = computeSignals(input)

    // Sort: strong confidence first, then by signal priority
    const PRIORITY: Record<string, number> = {
      lower_accuracy:            1,
      repeated_without_progress: 2,
      high_effort_low_progress:  3,
      confidence_gap:            4,
      persistence:               5,
      mastery:                   6,
      quick_success:             7,
      rushing_or_low_engagement: 8,
      avoidance_signal:          9,
      interest_signal:           10,
    }
    const CONFIDENCE_WEIGHT: Record<string, number> = { strong: 0, moderate: 100, early: 200 }

    return signals.sort((a, b) => {
      const cw = (CONFIDENCE_WEIGHT[a.confidence] ?? 300) - (CONFIDENCE_WEIGHT[b.confidence] ?? 300)
      if (cw !== 0) return cw
      return (PRIORITY[a.signalType] ?? 99) - (PRIORITY[b.signalType] ?? 99)
    })
  } catch {
    return []
  }
}
