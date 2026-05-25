/**
 * Learning Events — server-side helper for PLI v1.
 *
 * All event writes must go through recordLearningEvent().
 * The caller is responsible for verifying that profileId belongs to the
 * authenticated session before calling this module. Never trust client-supplied
 * profile IDs directly from request bodies.
 *
 * No LLM calls. No AI interpretation. Pure DB writes and reads.
 */

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

// ── Allowed event types (exhaustive union) ────────────────────────────────────

export const LEARNING_EVENT_TYPES = [
  'lesson_opened',
  'lesson_completed',
  'lesson_repeated',
  'lesson_exited_early',
  'lesson_active_time_recorded',
  'practice_started',
  'practice_completed',
  'quiz_started',
  'quiz_completed',
  'quiz_abandoned',
  'recommendation_shown',
  'recommendation_clicked',
  'recommendation_ignored',
] as const

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number]

export function isValidEventType(s: string): s is LearningEventType {
  return (LEARNING_EVENT_TYPES as readonly string[]).includes(s)
}

// ── Input / output types ──────────────────────────────────────────────────────

export interface RecordEventInput {
  profileId: string
  eventType: LearningEventType
  subjectId?: string | null
  topicId?: string | null
  lessonId?: string | null
  quizAttemptId?: string | null
  metadata?: Record<string, unknown>
}

export interface LearningEventRow {
  id: string
  profileId: string
  eventType: string
  subjectId: string | null
  topicId: string | null
  lessonId: string | null
  quizAttemptId: string | null
  metadata: Record<string, unknown>
  occurredAt: Date
}

export interface LessonBehaviourSummary {
  topicId: string
  openCount: number         // distinct lesson_opened events
  completionCount: number   // lesson_completed events
  repeatCount: number       // lesson_repeated events (same lesson opened >1 time)
  totalActiveSeconds: number // sum of lesson_active_time_recorded metadata.seconds
  lastOpenedAt: Date | null
  lastCompletedAt: Date | null
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Record a single learning event.
 * Caller must verify profileId ownership before calling.
 */
export async function recordLearningEvent(input: RecordEventInput): Promise<void> {
  await prisma.learningEvent.create({
    data: {
      profile_id:      input.profileId,
      event_type:      input.eventType,
      subject_id:      input.subjectId ?? null,
      topic_id:        input.topicId ?? null,
      lesson_id:       input.lessonId ?? null,
      quiz_attempt_id: input.quizAttemptId ?? null,
      metadata:        (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch raw learning events for a child profile, newest first.
 * Used by the signal engine and parent dashboard.
 */
export async function getLearningEventsForChild(
  childProfileId: string,
  opts: {
    eventTypes?: LearningEventType[]
    topicId?: string
    subjectId?: string
    limit?: number
    since?: Date
  } = {},
): Promise<LearningEventRow[]> {
  const rows = await prisma.learningEvent.findMany({
    where: {
      profile_id: childProfileId,
      ...(opts.eventTypes ? { event_type: { in: opts.eventTypes } } : {}),
      ...(opts.topicId    ? { topic_id: opts.topicId }             : {}),
      ...(opts.subjectId  ? { subject_id: opts.subjectId }         : {}),
      ...(opts.since      ? { occurred_at: { gte: opts.since } }   : {}),
    },
    orderBy: { occurred_at: 'desc' },
    take: opts.limit ?? 500,
  })

  return rows.map((r) => ({
    id:             r.id,
    profileId:      r.profile_id,
    eventType:      r.event_type,
    subjectId:      r.subject_id,
    topicId:        r.topic_id,
    lessonId:       r.lesson_id,
    quizAttemptId:  r.quiz_attempt_id,
    metadata:       (r.metadata as Record<string, unknown>) ?? {},
    occurredAt:     r.occurred_at,
  }))
}

/**
 * Returns a per-topic lesson behaviour summary for a child.
 * Groups lesson_opened / lesson_completed / lesson_repeated / lesson_active_time_recorded
 * events by topicId.
 */
export async function getLessonBehaviourSummary(
  childProfileId: string,
): Promise<LessonBehaviourSummary[]> {
  const events = await getLearningEventsForChild(childProfileId, {
    eventTypes: [
      'lesson_opened',
      'lesson_completed',
      'lesson_repeated',
      'lesson_active_time_recorded',
    ],
  })

  const byTopic = new Map<string, LessonBehaviourSummary>()

  for (const ev of events) {
    const tid = ev.topicId
    if (!tid) continue

    if (!byTopic.has(tid)) {
      byTopic.set(tid, {
        topicId:          tid,
        openCount:        0,
        completionCount:  0,
        repeatCount:      0,
        totalActiveSeconds: 0,
        lastOpenedAt:     null,
        lastCompletedAt:  null,
      })
    }
    const s = byTopic.get(tid)!

    if (ev.eventType === 'lesson_opened') {
      s.openCount++
      if (!s.lastOpenedAt || ev.occurredAt > s.lastOpenedAt) s.lastOpenedAt = ev.occurredAt
    }
    if (ev.eventType === 'lesson_completed') {
      s.completionCount++
      if (!s.lastCompletedAt || ev.occurredAt > s.lastCompletedAt) s.lastCompletedAt = ev.occurredAt
    }
    if (ev.eventType === 'lesson_repeated') {
      s.repeatCount++
    }
    if (ev.eventType === 'lesson_active_time_recorded') {
      const secs = typeof ev.metadata.seconds === 'number' ? ev.metadata.seconds : 0
      s.totalActiveSeconds += secs
    }
  }

  return Array.from(byTopic.values())
}
