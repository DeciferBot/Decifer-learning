/**
 * Parent Dashboard — server-side data layer.
 *
 * All functions return real DB records only.
 * Lesson queries always enforce: status='published' AND verification_status='verified'.
 * No AI generation, no seed imports, no verification scripts.
 */

import { prisma } from './prisma'

// ── Safety gate applied to every lesson query ─────────────────────────────────

const PUBLISHED_VERIFIED = {
  status: 'published' as const,
  verification_status: 'verified',
} satisfies { status: string; verification_status: string }

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

export type WeakArea = {
  topicId: string
  topicTitle: string
  totalAnswered: number
  incorrectCount: number
  errorRate: number // 0.0–1.0
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
 * Returns an empty array when no quiz data exists.
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
      topic: { select: { title: true } },
    },
  })
  if (attempts.length === 0) return []

  const attemptIds = attempts.map((a) => a.id)
  const answers = await prisma.quizAnswer.findMany({
    where: { attempt_id: { in: attemptIds } },
    select: { attempt_id: true, was_correct: true },
  })

  // Map attempt → topic
  const attemptTopicMap = new Map<string, { topicId: string; title: string }>()
  for (const a of attempts) {
    attemptTopicMap.set(a.id, { topicId: a.topic_id, title: a.topic.title })
  }

  // Group answers by topic and accumulate counts
  const topicStats = new Map<string, { title: string; correct: number; total: number }>()
  for (const ans of answers) {
    const topic = attemptTopicMap.get(ans.attempt_id)
    if (!topic) continue
    if (!topicStats.has(topic.topicId)) {
      topicStats.set(topic.topicId, { title: topic.title, correct: 0, total: 0 })
    }
    const stat = topicStats.get(topic.topicId)!
    stat.total++
    if (ans.was_correct) stat.correct++
  }

  const weakAreas: WeakArea[] = []
  for (const [topicId, { title, correct, total }] of topicStats.entries()) {
    if (total < MIN_ANSWERS) continue
    const errorRate = (total - correct) / total
    if (errorRate >= ERROR_RATE_THRESHOLD) {
      weakAreas.push({
        topicId,
        topicTitle: title,
        totalAnswered: total,
        incorrectCount: total - correct,
        errorRate,
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
