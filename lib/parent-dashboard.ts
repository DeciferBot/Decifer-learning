/**
 * Parent Dashboard — server-side data layer (PLI v1).
 *
 * All functions return real DB records only.
 * Lesson queries always enforce: status='published' AND verification_status='verified'.
 * No AI generation, no LLM calls, no seed imports.
 *
 * PLI v1 additions:
 *   - signalLevel(): confidence tiering for evidence counts
 *   - getProgressBySubject(): per-subject breakdown
 *   - getStrongestTopics(): topics with high accuracy evidence
 *   - WeakArea now includes signal, evidence count, and subject name
 */

import { prisma } from './prisma'

// ── Safety gate applied to every lesson query ─────────────────────────────────

const PUBLISHED_VERIFIED = {
  status: 'published' as const,
  verification_status: 'verified',
} satisfies { status: string; verification_status: string }

// ── Signal confidence helper ───────────────────────────────────────────────────

/**
 * Converts an evidence count (quiz answers, attempts, events) into a
 * human-readable confidence level.
 *
 * early:    3–5 evidence points  — pattern emerging, not yet reliable
 * moderate: 6–14                 — consistent enough to surface to parent
 * strong:   15+                  — well-established pattern
 */
export type SignalConfidence = 'early' | 'moderate' | 'strong'

export function signalLevel(evidenceCount: number): SignalConfidence {
  if (evidenceCount >= 15) return 'strong'
  if (evidenceCount >= 6)  return 'moderate'
  return 'early'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type LinkedChild = {
  profileId: string
  userId: string
  displayName: string
  yearGroupLabel: string | null
  keyStage: string | null
  totalPoints: number
  streakDays: number
}

export type ChildProgressSummary = {
  topicsStarted: number
  topicsCompleted: number
  quizAttempts: number
  quizzesThisWeek: number
  averageScore: number | null // 0.0–1.0; null if no attempts
  badgeCount: number
  cardCount: number
}

// PLI v1: subject-level breakdown
export type SubjectProgress = {
  subjectId: string
  subjectName: string
  colourToken: string
  topicsStarted: number
  topicsCompleted: number
  averageScore: number | null   // null = no scored attempts in this subject
  totalQuizAttempts: number
  lastActivityAt: Date | null
}

// PLI v1: strongest topics
export type StrongTopic = {
  topicId: string
  topicTitle: string
  subjectName: string
  lastScore: number             // 0.0–1.0
  completedAt: Date | null
  repetitions: number           // sr_repetitions — proxy for spaced review count
  signal: 'early' | 'strong'   // only two tiers: one completion vs. repeated reviews
}

export type WeakArea = {
  topicId: string
  topicTitle: string
  subjectName: string           // PLI v1: added subject name
  totalAnswered: number
  incorrectCount: number
  errorRate: number             // 0.0–1.0
  signal: SignalConfidence      // PLI v1: evidence confidence
}

export type RecentActivityItem = {
  attemptId: string
  topicTitle: string
  score: number // 0.0–1.0
  hintsUsed: number
  createdAt: Date
}

export type RecommendedLesson = {
  lessonId: string
  lessonTitle: string
  lessonSlug: string
  topicTitle: string
  subjectName: string
  subjectSlug: string
  topicSlug: string
  difficultyLane: string | null
  estimatedMinutes: number | null
  isFirstLesson: boolean // true = "Start with this", false = "Continue"
}

export type EarnedBadge = {
  badgeId: string
  name: string
  description: string | null
  iconUrl: string | null
  awardedAt: Date
}

export type CardCollectionSummary = {
  total: number
  byRarity: Record<string, number>
}

// ── Functions ─────────────────────────────────────────────────────────────────

// ── PLI v1: Subject-level progress breakdown ──────────────────────────────────

/**
 * Returns per-subject progress for a child.
 * Only subjects where the child has at least one topic_progress row are returned.
 * Average score is derived from quiz_attempts for that subject (null if none).
 */
export async function getProgressBySubject(
  childProfileId: string,
): Promise<SubjectProgress[]> {
  // Load all topic_progress rows with subject info
  const progressRows = await prisma.topicProgress.findMany({
    where:   { profile_id: childProfileId },
    include: { topic: { include: { subject: true } } },
  })

  if (progressRows.length === 0) return []

  // Load quiz_attempts to get per-subject attempt counts + scores + last activity
  const quizAttempts = await prisma.quizAttempt.findMany({
    where:   { profile_id: childProfileId },
    orderBy: { created_at: 'desc' },
    select:  { score: true, created_at: true, topic: { select: { subject_id: true } } },
  })

  // Group topic_progress by subject
  type SubjectAccum = {
    subjectId: string
    subjectName: string
    colourToken: string
    topicsStarted: number
    topicsCompleted: number
  }
  const subjectMap = new Map<string, SubjectAccum>()

  for (const row of progressRows) {
    const s = row.topic.subject
    if (!subjectMap.has(s.id)) {
      subjectMap.set(s.id, {
        subjectId:      s.id,
        subjectName:    s.name,
        colourToken:    s.colour_token,
        topicsStarted:  0,
        topicsCompleted: 0,
      })
    }
    const acc = subjectMap.get(s.id)!
    acc.topicsStarted++
    if (row.status === 'completed') acc.topicsCompleted++
  }

  // Group quiz_attempts by subject
  type AttemptAccum = { scores: number[]; lastAt: Date | null }
  const attemptMap = new Map<string, AttemptAccum>()

  for (const a of quizAttempts) {
    const sid = a.topic.subject_id
    if (!attemptMap.has(sid)) attemptMap.set(sid, { scores: [], lastAt: null })
    const acc = attemptMap.get(sid)!
    acc.scores.push(a.score)
    if (!acc.lastAt || a.created_at > acc.lastAt) acc.lastAt = a.created_at
  }

  return Array.from(subjectMap.values()).map((s) => {
    const attempts = attemptMap.get(s.subjectId)
    const scores   = attempts?.scores ?? []
    return {
      subjectId:         s.subjectId,
      subjectName:       s.subjectName,
      colourToken:       s.colourToken,
      topicsStarted:     s.topicsStarted,
      topicsCompleted:   s.topicsCompleted,
      averageScore:      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      totalQuizAttempts: scores.length,
      lastActivityAt:    attempts?.lastAt ?? null,
    }
  })
}

// ── PLI v1: Strongest topics ──────────────────────────────────────────────────

/**
 * Returns topics where the child scored ≥ 80% on the most recent attempt.
 * Only topics with status='completed' or last_score ≥ 0.80 are included.
 *
 * Signal:
 *   'strong'  — sr_repetitions ≥ 2 (reviewed and maintained accuracy across multiple attempts)
 *   'early'   — one completion only
 *
 * Copy rule: never say "your child is great at X".
 * Use: "Completed with 85% on the last attempt." or
 *      "Repeated successfully across 2 review attempts."
 */
export async function getStrongestTopics(
  childProfileId: string,
  limit = 5,
): Promise<StrongTopic[]> {
  const rows = await prisma.topicProgress.findMany({
    where: {
      profile_id: childProfileId,
      last_score: { gte: 0.80 },
    },
    include: {
      topic: {
        include: { subject: { select: { name: true } } },
      },
    },
    orderBy: { last_score: 'desc' },
    take: limit * 2, // fetch more to allow dedup/filter
  })

  return rows
    .filter((r): r is typeof r & { last_score: number } => r.last_score !== null)
    .slice(0, limit)
    .map((r) => ({
      topicId:     r.topic_id,
      topicTitle:  r.topic.title,
      subjectName: r.topic.subject.name,
      lastScore:   r.last_score,
      completedAt: r.completed_at,
      repetitions: r.sr_repetitions,
      signal:      r.sr_repetitions >= 2 ? ('strong' as const) : ('early' as const),
    }))
}

// ── Core data functions ───────────────────────────────────────────────────────

/**
 * Returns all child profiles linked to the given parent (by auth user_id).
 */
export async function getLinkedChildren(parentUserId: string): Promise<LinkedChild[]> {
  const links = await prisma.familyLink.findMany({
    where: { parent_user_id: parentUserId },
    include: {
      child: {
        include: { year_group: true },
      },
    },
  })

  return links.map((link) => ({
    profileId: link.child.id,
    userId: link.child.user_id,
    displayName: link.child.display_name,
    yearGroupLabel: link.child.year_group?.label ?? null,
    keyStage: link.child.year_group?.key_stage ?? null,
    totalPoints: link.child.total_points,
    streakDays: link.child.streak_days,
  }))
}

/**
 * Returns progress counts for a single child profile.
 */
export async function getChildProgressSummary(
  childProfileId: string,
): Promise<ChildProgressSummary> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [topicProgress, attempts, attemptsThisWeek, badgeCount, cardCount] = await Promise.all([
    prisma.topicProgress.findMany({
      where: { profile_id: childProfileId },
      select: { status: true },
    }),
    prisma.quizAttempt.findMany({
      where: { profile_id: childProfileId },
      select: { score: true },
    }),
    prisma.quizAttempt.count({
      where: { profile_id: childProfileId, created_at: { gte: weekAgo } },
    }),
    prisma.profileBadge.count({ where: { profile_id: childProfileId } }),
    prisma.childCollection.count({ where: { profile_id: childProfileId } }),
  ])

  const topicsStarted = topicProgress.length
  const topicsCompleted = topicProgress.filter((t) => t.status === 'completed').length
  const quizAttempts = attempts.length
  const averageScore =
    attempts.length > 0
      ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
      : null

  return {
    topicsStarted,
    topicsCompleted,
    quizAttempts,
    quizzesThisWeek: attemptsThisWeek,
    averageScore,
    badgeCount,
    cardCount,
  }
}

/**
 * Returns topics where the child's error rate exceeds ERROR_RATE_THRESHOLD.
 * Requires at least MIN_ANSWERS answers per topic before flagging.
 * PLI v1: now includes subjectName and signal confidence level.
 *
 * Copy rule: do not say "your child struggles with X".
 * Use: "Lower accuracy in this topic across N answers."
 */
const MIN_ANSWERS = 3
const ERROR_RATE_THRESHOLD = 0.5

export async function getChildWeakAreas(
  childProfileId: string,
  limit = 5,
): Promise<WeakArea[]> {
  const attempts = await prisma.quizAttempt.findMany({
    where: { profile_id: childProfileId },
    select: {
      id: true,
      topic_id: true,
      topic: {
        select: {
          title: true,
          subject: { select: { name: true } },
        },
      },
    },
  })
  if (attempts.length === 0) return []

  const attemptIds = attempts.map((a) => a.id)
  const answers = await prisma.quizAnswer.findMany({
    where: { attempt_id: { in: attemptIds } },
    select: { attempt_id: true, was_correct: true },
  })

  // Map attempt → topic
  const attemptTopicMap = new Map<string, { topicId: string; title: string; subjectName: string }>()
  for (const a of attempts) {
    attemptTopicMap.set(a.id, {
      topicId:     a.topic_id,
      title:       a.topic.title,
      subjectName: a.topic.subject.name,
    })
  }

  // Group answers by topic and accumulate counts
  const topicStats = new Map<string, { title: string; subjectName: string; correct: number; total: number }>()
  for (const ans of answers) {
    const topic = attemptTopicMap.get(ans.attempt_id)
    if (!topic) continue
    if (!topicStats.has(topic.topicId)) {
      topicStats.set(topic.topicId, { title: topic.title, subjectName: topic.subjectName, correct: 0, total: 0 })
    }
    const stat = topicStats.get(topic.topicId)!
    stat.total++
    if (ans.was_correct) stat.correct++
  }

  const weakAreas: WeakArea[] = []
  for (const [topicId, { title, subjectName, correct, total }] of topicStats.entries()) {
    if (total < MIN_ANSWERS) continue
    const errorRate = (total - correct) / total
    if (errorRate >= ERROR_RATE_THRESHOLD) {
      weakAreas.push({
        topicId,
        topicTitle:    title,
        subjectName,
        totalAnswered: total,
        incorrectCount: total - correct,
        errorRate,
        signal:        signalLevel(total),
      })
    }
  }

  return weakAreas.sort((a, b) => b.errorRate - a.errorRate).slice(0, limit)
}

/**
 * Returns the recommended next published+verified lesson for a child.
 * Priority: in-progress topics → unstarted topics → null.
 */
export async function getRecommendedNextLesson(
  childProfileId: string,
  yearGroupLabel: string | null,
): Promise<RecommendedLesson | null> {
  if (!yearGroupLabel) return null

  const [completedProgress, inProgressProgress] = await Promise.all([
    prisma.topicProgress.findMany({
      where: { profile_id: childProfileId, status: 'completed' },
      select: { topic_id: true },
    }),
    prisma.topicProgress.findMany({
      where: { profile_id: childProfileId, status: { not: 'completed' } },
      select: { topic_id: true },
    }),
  ])

  const completedTopicIds = completedProgress.map((p) => p.topic_id)
  const inProgressTopicIds = inProgressProgress.map((p) => p.topic_id)
  const hasAnyProgress = completedTopicIds.length > 0 || inProgressTopicIds.length > 0

  const lessonSelect = {
    id: true,
    title: true,
    slug: true,
    difficulty_lane: true,
    estimated_minutes: true,
    topic: {
      select: {
        title: true,
        slug: true,
        subject: { select: { name: true, slug: true } },
      },
    },
  } as const

  // Try in-progress topics first
  if (inProgressTopicIds.length > 0) {
    const lesson = await prisma.lesson.findFirst({
      where: {
        ...PUBLISHED_VERIFIED,
        year_group: yearGroupLabel,
        topic_id: { in: inProgressTopicIds },
      },
      select: lessonSelect,
      orderBy: [{ difficulty_lane: 'asc' }, { title: 'asc' }],
    })
    if (lesson?.topic.slug && lesson.topic.subject.slug) {
      return toRecommendedLesson(lesson, !hasAnyProgress)
    }
  }

  // Fall back: first published+verified lesson not in completed topics
  const lesson = await prisma.lesson.findFirst({
    where: {
      ...PUBLISHED_VERIFIED,
      year_group: yearGroupLabel,
      ...(completedTopicIds.length > 0 ? { topic_id: { notIn: completedTopicIds } } : {}),
    },
    select: lessonSelect,
    orderBy: [{ difficulty_lane: 'asc' }, { title: 'asc' }],
  })

  if (!lesson?.topic.slug || !lesson.topic.subject.slug) return null
  return toRecommendedLesson(lesson, !hasAnyProgress)
}

type LessonRow = {
  id: string
  title: string
  slug: string
  difficulty_lane: string | null
  estimated_minutes: number | null
  topic: { title: string; slug: string | null; subject: { name: string; slug: string | null } }
}

function toRecommendedLesson(lesson: LessonRow, isFirstLesson: boolean): RecommendedLesson {
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonSlug: lesson.slug,
    topicTitle: lesson.topic.title,
    subjectName: lesson.topic.subject.name,
    subjectSlug: lesson.topic.subject.slug ?? '',
    topicSlug: lesson.topic.slug ?? '',
    difficultyLane: lesson.difficulty_lane,
    estimatedMinutes: lesson.estimated_minutes,
    isFirstLesson,
  }
}

/**
 * Returns the topic_id from the most recent quiz attempt or topic progress row.
 * Returns null if no activity exists.
 */
export async function getMostRecentTopicId(childProfileId: string): Promise<string | null> {
  const recent = await prisma.quizAttempt.findFirst({
    where: { profile_id: childProfileId },
    orderBy: { created_at: 'desc' },
    select: { topic_id: true },
  })
  if (recent) return recent.topic_id

  const progress = await prisma.topicProgress.findFirst({
    where: { profile_id: childProfileId },
    select: { topic_id: true },
  })
  return progress?.topic_id ?? null
}

/**
 * Returns the last N quiz attempts with topic names, newest first.
 */
export async function getRecentActivity(
  childProfileId: string,
  limit = 7,
): Promise<RecentActivityItem[]> {
  const attempts = await prisma.quizAttempt.findMany({
    where: { profile_id: childProfileId },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      score: true,
      hints_used: true,
      created_at: true,
      topic: { select: { title: true } },
    },
  })

  return attempts.map((a) => ({
    attemptId: a.id,
    topicTitle: a.topic.title,
    score: a.score,
    hintsUsed: a.hints_used,
    createdAt: a.created_at,
  }))
}

/**
 * Returns earned badges for a child profile, most recent first.
 */
export async function getEarnedBadges(childProfileId: string): Promise<EarnedBadge[]> {
  const rows = await prisma.profileBadge.findMany({
    where: { profile_id: childProfileId },
    include: { badge: true },
    orderBy: { awarded_at: 'desc' },
  })

  return rows.map((row) => ({
    badgeId: row.badge_id,
    name: row.badge.name,
    description: row.badge.description,
    iconUrl: row.badge.icon_url,
    awardedAt: row.awarded_at,
  }))
}

/**
 * Returns the card collection summary for a child (total count + count by rarity).
 */
export async function getCardCollectionSummary(
  childProfileId: string,
): Promise<CardCollectionSummary> {
  const entries = await prisma.childCollection.findMany({
    where: { profile_id: childProfileId },
    select: {
      quantity: true,
      card: { select: { rarity: true } },
    },
  })

  const byRarity: Record<string, number> = {}
  for (const entry of entries) {
    byRarity[entry.card.rarity] = (byRarity[entry.card.rarity] ?? 0) + entry.quantity
  }

  return { total: entries.length, byRarity }
}

// ── Reward Vault ──────────────────────────────────────────────────────────────

export interface ChildVaultSummary {
  creditBalance: number
  currentBand: string
  pendingRequestCount: number
}

export interface PendingVaultRequest {
  requestId: string
  childProfileId: string
  childName: string
  milestoneBand: string
  childMessage: string | null
  xpAtRequest: number
  topicsAtRequest: number
  status: string
  createdAt: Date
}

export async function getChildVaultSummary(childProfileId: string): Promise<ChildVaultSummary> {
  const [vaultStatus, pendingCount] = await Promise.all([
    prisma.childVaultStatus.findUnique({
      where: { profile_id: childProfileId },
      select: { credit_balance: true, current_band: true },
    }),
    prisma.rewardRequest.count({
      where: {
        child_profile_id: childProfileId,
        status: { in: ['pending', 'deferred', 'counter_offered'] },
      },
    }),
  ])

  return {
    creditBalance: vaultStatus?.credit_balance ?? 0,
    currentBand: vaultStatus?.current_band ?? 'none',
    pendingRequestCount: pendingCount,
  }
}

// ── Weekly digest summary (PLI v2) ──────────────────────────────────────────

export interface WeeklyDigestSummary {
  quizAttempts:    number
  activeDays:      number
  passRate:        number | null   // 0-100
  avgScore:        number | null   // 0-100
  pointsThisWeek:  number
  topicsCompleted: number
  topSignal:       { title: string; recommendedAction: string } | null
}

export async function getChildWeeklyDigestSummary(
  childProfileId: string,
): Promise<WeeklyDigestSummary> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const [attempts, completedCount, pointsAgg] = await Promise.all([
    prisma.quizAttempt.findMany({
      where:  { profile_id: childProfileId, created_at: { gte: weekAgo } },
      select: { score: true, created_at: true },
    }),
    prisma.topicProgress.count({
      where: { profile_id: childProfileId, completed_at: { gte: weekAgo } },
    }),
    prisma.pointEvent.aggregate({
      where: { profile_id: childProfileId, created_at: { gte: weekAgo } },
      _sum:  { amount: true },
    }),
  ])

  const passRate = attempts.length > 0
    ? Math.round((attempts.filter((a) => a.score >= 0.7).length / attempts.length) * 100)
    : null

  const avgScore = attempts.length > 0
    ? Math.round((attempts.reduce((s, a) => s + a.score, 0) / attempts.length) * 100)
    : null

  const activeDays = new Set(
    attempts.map((a) => a.created_at.toISOString().slice(0, 10)),
  ).size

  return {
    quizAttempts:   attempts.length,
    activeDays,
    passRate,
    avgScore,
    pointsThisWeek: pointsAgg._sum.amount ?? 0,
    topicsCompleted: completedCount,
    topSignal:      null,   // kept lightweight — full signals via /api/parent/digest
  }
}

export async function getPendingVaultRequests(parentProfileId: string): Promise<PendingVaultRequest[]> {
  const requests = await prisma.rewardRequest.findMany({
    where: {
      parent_profile_id: parentProfileId,
      status: { in: ['pending', 'deferred', 'counter_offered'] },
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      child_profile_id: true,
      milestone_band: true,
      child_message: true,
      xp_at_request: true,
      topics_at_request: true,
      status: true,
      created_at: true,
      child: { select: { display_name: true } },
    },
  })

  return requests.map((r) => ({
    requestId: r.id,
    childProfileId: r.child_profile_id,
    childName: r.child.display_name,
    milestoneBand: r.milestone_band,
    childMessage: r.child_message,
    xpAtRequest: r.xp_at_request,
    topicsAtRequest: r.topics_at_request,
    status: r.status,
    createdAt: r.created_at,
  }))
}
