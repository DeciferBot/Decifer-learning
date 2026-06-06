import { NextResponse } from 'next/server'
import type { Badge } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcQuizPoints, scoreToSm2Quality } from '@/lib/points'
import { sm2 } from '@/lib/sm2'
import { pickRarity } from '@/lib/cards'
import { checkAndUpdateMilestone } from '@/lib/vault/status'
import { recordLearningEvent } from '@/lib/learning-events'

type AnswerInput = {
  questionId: string
  childAnswer: string
  wasCorrect: boolean
  hintNumber: number
  timeSeconds: number
}

type SubmitBody = {
  topicId: string
  answers: AnswerInput[]
  timeTakenSeconds: number
  heartsRemaining: number
}

export type DroppedCard = {
  id: string
  title: string
  fact_text: string
  rarity: string
  isNew: boolean
}

export type EarnedBadge = {
  id: string
  name: string
  description: string | null
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SubmitBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topicId, answers, timeTakenSeconds, heartsRemaining } = body
  if (!topicId || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Wave 1: profile + correct answers in parallel (correct answers need only topicId, not profile.id)
  const questionIds = answers.map((a) => a.questionId)
  const [profile, correctAnswers] = await Promise.all([
    prisma.profile.findUnique({ where: { user_id: user.id } }),
    prisma.quizQuestion.findMany({
      where:  { id: { in: questionIds }, topic_id: topicId, status: 'published' },
      select: { id: true, correct_answer: true },
    }),
  ])

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.year_group_id) {
    return NextResponse.json({ error: 'Profile has no year group assigned' }, { status: 403 })
  }

  // Wave 2: topic guard + parent controls in parallel (both need profile.id / year_group_id)
  const [topicRow, controls] = await Promise.all([
    prisma.topic.findFirst({
      where:  { id: topicId, year_group_id: profile.year_group_id },
      select: { id: true },
    }),
    prisma.parentControl.findUnique({
      where:  { child_profile_id: profile.id },
      select: { daily_time_limit_minutes: true },
    }),
  ])

  if (!topicRow) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  // ── Screen-time enforcement ───────────────────────────────────────────────
  if (controls) {
    const limitSeconds  = controls.daily_time_limit_minutes * 60
    const todayStart    = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { _sum } = await prisma.quizAttempt.aggregate({
      where: { profile_id: profile.id, created_at: { gte: todayStart } },
      _sum:  { time_taken_seconds: true },
    })
    const usedSeconds = (_sum.time_taken_seconds ?? 0) + (timeTakenSeconds ?? 0)
    if (usedSeconds >= limitSeconds) {
      return NextResponse.json(
        { error: 'Daily screen-time limit reached', code: 'SCREEN_TIME_LIMIT', limitMinutes: controls.daily_time_limit_minutes },
        { status: 422 },
      )
    }
  }
  // ── End screen-time enforcement ───────────────────────────────────────────
  const correctMap = new Map(correctAnswers.map((q) => [q.id, q.correct_answer]))

  const scoredAnswers = answers.map((a) => ({
    ...a,
    wasCorrect: correctMap.get(a.questionId)?.trim().toLowerCase() === a.childAnswer?.trim().toLowerCase(),
  }))
  // ── End server-side scoring ───────────────────────────────────────────────

  const totalQuestions = scoredAnswers.length
  const correctCount   = scoredAnswers.filter((a) => a.wasCorrect).length
  const scoreFraction  = correctCount / totalQuestions
  const passed         = scoreFraction >= 0.7
  const hintsUsedCount = scoredAnswers.filter((a) => a.hintNumber > 0).length
  const perfectScore   = correctCount === totalQuestions && hintsUsedCount === 0

  const points = calcQuizPoints(scoredAnswers)

  const { streakDays, newStreak, streakProfileUpdate } = calcStreakUpdate(profile)

  const result = await prisma.$transaction(async (tx) => {
    // Write quiz_attempt
    const attempt = await tx.quizAttempt.create({
      data: {
        profile_id: profile.id,
        topic_id: topicId,
        score: scoreFraction,
        hints_used: hintsUsedCount,
        time_taken_seconds: timeTakenSeconds ?? 0,
        hearts_remaining: heartsRemaining,
      },
    })

    // Write quiz_answers
    await tx.quizAnswer.createMany({
      data: scoredAnswers.map((a) => ({
        attempt_id: attempt.id,
        question_id: a.questionId,
        child_answer: a.childAnswer,
        was_correct: a.wasCorrect,
        hint_number: a.hintNumber,
        time_seconds: a.timeSeconds ?? 0,
      })),
    })

    // Award points
    const newTotalPoints = profile.total_points + points
    if (points > 0) {
      await tx.pointEvent.create({
        data: {
          profile_id: profile.id,
          amount: points,
          reason: passed ? `quiz:${topicId}:pass` : `quiz:${topicId}`,
        },
      })
    }

    // SM-2 + topic_progress if passed
    let smEasiness = profile.sr_easiness
    if (passed) {
      const existing = await tx.topicProgress.findUnique({
        where: { profile_id_topic_id: { profile_id: profile.id, topic_id: topicId } },
      })

      const quality = scoreToSm2Quality(scoreFraction, hintsUsedCount)
      const { reps, easiness, interval } = sm2(
        quality,
        existing?.sr_repetitions ?? 0,
        profile.sr_easiness ?? 2.5,
        existing?.sr_interval_days ?? 1,
      )
      smEasiness = easiness

      const nextReview = new Date()
      nextReview.setDate(nextReview.getDate() + interval)

      await tx.topicProgress.upsert({
        where: { profile_id_topic_id: { profile_id: profile.id, topic_id: topicId } },
        create: {
          profile_id: profile.id,
          topic_id: topicId,
          status: 'completed',
          last_score: scoreFraction,
          completed_at: new Date(),
          sr_repetitions: reps,
          sr_interval_days: interval,
          sr_next_review: nextReview,
        },
        update: {
          status: 'completed',
          last_score: scoreFraction,
          completed_at: new Date(),
          sr_repetitions: reps,
          sr_interval_days: interval,
          sr_next_review: nextReview,
        },
      })
    }

    // Update profile (points + streak + SM-2 in one write)
    await tx.profile.update({
      where: { id: profile.id },
      data: {
        total_points: newTotalPoints,
        sr_easiness: smEasiness,
        ...streakProfileUpdate,
      },
    })

    // ── First-win detection ───────────────────────────────────────────────
    // True when this pass is the child's very first completed topic ever.
    let isFirstWin = false
    if (passed) {
      const completedCount = await tx.topicProgress.count({
        where: { profile_id: profile.id, status: 'completed' },
      })
      isFirstWin = completedCount === 1
    }

    // ── Badge checks ──────────────────────────────────────────────────────
    const newBadges = await checkBadges(tx, {
      profileId: profile.id,
      passed,
      perfectScore,
      newStreakDays: streakDays,
    })

    // ── Streak shield award (when Streak 7 earned for the first time) ─────
    let shieldAwarded = false
    const streak7Badge = newBadges.find(
      (b) =>
        b !== null &&
        typeof b.trigger_rule === 'object' &&
        b.trigger_rule !== null &&
        (b.trigger_rule as { type: string }).type === 'streak_days',
    )
    if (streak7Badge) {
      await tx.$executeRaw`
        INSERT INTO streak_shields (profile_id, quantity)
        VALUES (${profile.id}::uuid, 1)
        ON CONFLICT (profile_id)
        DO UPDATE SET quantity = streak_shields.quantity + 1
      `
      shieldAwarded = true
    }

    return {
      newTotalPoints,
      isFirstWin,
      newBadges: newBadges
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map((b) => ({
          id: b.id,
          name: b.name ?? '',
          description: b.description ?? '',
        })) satisfies EarnedBadge[],
      shieldAwarded,
    }
  }, { timeout: 15000 })

  // ── Card drop — runs OUTSIDE the main transaction so quiz results always save ─
  // A failure here logs and returns null; it never breaks the quiz response.
  let droppedCard: DroppedCard | null = null
  if (passed) {
    try {
      droppedCard = await dropCard(prisma, profile.id, profile.year_group_id)
    } catch (err) {
      console.error('[quiz/submit] card drop failed:', err)
    }
  }

  // Non-blocking milestone check — fires after response is returned.
  // Vault writes are isolated; any failure here must not affect the quiz result.
  if (passed) {
    void checkAndUpdateMilestone(profile.id).catch((err) => {
      console.error('[quiz/submit] milestone check failed:', err)
    })
  }

  // PLI v1: record quiz_completed event (non-blocking, never fails the quiz response)
  void (async () => {
    try {
      const topicSubject = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { subject_id: true },
      })
      await recordLearningEvent({
        profileId:  profile.id,
        eventType:  'quiz_completed',
        topicId,
        subjectId:  topicSubject?.subject_id ?? null,
        metadata: {
          score:          Math.round(scoreFraction * 100),
          passed,
          hintsUsed:      hintsUsedCount,
          timeSecs:       timeTakenSeconds ?? 0,
          heartsRemaining,
        },
      })
    } catch {
      // event tracking must never break quiz submission
    }
  })()

  return NextResponse.json({
    points,
    passed,
    score: correctCount,
    totalQuestions,
    totalPoints: result.newTotalPoints,
    streakDays,
    newStreak,
    droppedCard,
    newBadges: result.newBadges,
    shieldAwarded: result.shieldAwarded,
    isFirstWin: result.isFirstWin,
  })
}

// ── Card drop ─────────────────────────────────────────────────────────────

async function dropCard(
  db: typeof prisma,
  profileId: string,
  yearGroupId: string | null,
): Promise<DroppedCard | null> {
  const rarity = pickRarity()
  console.log('[dropCard] rarity:', rarity, 'yearGroupId:', yearGroupId)

  // Find published cards for this rarity: year-group-specific OR shared (null)
  const candidates = await db.cardCatalog.findMany({
    where: {
      rarity,
      status: 'published',
      OR: [
        { year_group_id: yearGroupId ?? undefined },
        { year_group_id: null },
      ],
    },
  })
  if (candidates.length === 0) return null

  const card = candidates[Math.floor(Math.random() * candidates.length)]

  console.log('[dropCard] candidates found:', candidates.length, 'picking card:', card.id, card.title)

  // Upsert child_collection
  const existing = await db.childCollection.findUnique({
    where: { profile_id_card_id: { profile_id: profileId, card_id: card.id } },
  })
  if (existing) {
    await db.childCollection.update({
      where: { profile_id_card_id: { profile_id: profileId, card_id: card.id } },
      data: { quantity: { increment: 1 } },
    })
  } else {
    await db.childCollection.create({
      data: { profile_id: profileId, card_id: card.id, quantity: 1 },
    })
  }
  console.log('[dropCard] card written to collection, isNew:', !existing)

  return {
    id: card.id,
    title: card.title,
    fact_text: card.fact_text,
    rarity: card.rarity,
    isNew: !existing,
  }
}

// ── Badge checks ──────────────────────────────────────────────────────────

async function checkBadges(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: {
    profileId: string
    passed: boolean
    perfectScore: boolean
    newStreakDays: number
  },
) {
  const { profileId, passed, perfectScore, newStreakDays } = opts
  const awarded: Badge[] = []

  // Existing badges for this profile (to avoid double-awarding)
  const existing = await tx.profileBadge.findMany({
    where: { profile_id: profileId },
    select: { badge_id: true },
  })
  const ownedIds = new Set(existing.map((e) => e.badge_id))

  const allBadges = await tx.badge.findMany()

  for (const badge of allBadges) {
    if (ownedIds.has(badge.id)) continue

    const rule = badge.trigger_rule as { type: string; threshold?: number }
    let shouldAward = false

    if (rule.type === 'topic_complete' && passed) {
      // First topic completion ever
      const completedTopics = await tx.topicProgress.count({
        where: { profile_id: profileId, status: 'completed' },
      })
      shouldAward = completedTopics === 1
    } else if (rule.type === 'perfect_score' && perfectScore) {
      shouldAward = true
    } else if (rule.type === 'streak_days' && rule.threshold) {
      shouldAward = newStreakDays >= rule.threshold
    }
    // subject_complete not triggered yet (Phase 11)
    // guardian_win is handled in /api/guardian/[zoneId]/submit — not here

    if (shouldAward) {
      await tx.profileBadge.create({
        data: { profile_id: profileId, badge_id: badge.id },
      })
      awarded.push(badge)
    }
  }

  return awarded
}

// ── Streak calculation ────────────────────────────────────────────────────

function calcStreakUpdate(profile: {
  last_active: Date | null
  streak_days: number
}): {
  streakDays: number
  newStreak: boolean
  streakProfileUpdate: { streak_days: number; last_active: Date }
} {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const lastStr = profile.last_active?.toISOString().slice(0, 10)

  if (lastStr === todayStr) {
    return {
      streakDays: profile.streak_days,
      newStreak: false,
      streakProfileUpdate: { streak_days: profile.streak_days, last_active: now },
    }
  }

  let newStreakDays: number
  if (lastStr) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    newStreakDays = lastStr === yesterdayStr ? profile.streak_days + 1 : 1
  } else {
    newStreakDays = 1
  }

  return {
    streakDays: newStreakDays,
    newStreak: newStreakDays !== profile.streak_days,
    streakProfileUpdate: { streak_days: newStreakDays, last_active: now },
  }
}
