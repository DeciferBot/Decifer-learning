import { NextResponse } from 'next/server'
import type { Badge } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcQuizPoints, scoreToSm2Quality } from '@/lib/points'
import { sm2 } from '@/lib/sm2'
import { pickRarity } from '@/lib/cards'

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

  const profile = await prisma.profile.findUnique({ where: { user_id: user.id } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const totalQuestions = answers.length
  const correctCount = answers.filter((a) => a.wasCorrect).length
  const scoreFraction = correctCount / totalQuestions
  const passed = scoreFraction >= 0.7
  const hintsUsedCount = answers.filter((a) => a.hintNumber > 0).length
  const perfectScore = correctCount === totalQuestions && hintsUsedCount === 0

  const points = calcQuizPoints(answers)

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
      data: answers.map((a) => ({
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

    // ── Card drop (on pass) ───────────────────────────────────────────────
    let droppedCard: DroppedCard | null = null
    if (passed) {
      droppedCard = await dropCard(tx, profile.id, profile.year_group_id)
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
      droppedCard,
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

  return NextResponse.json({
    points,
    passed,
    score: correctCount,
    totalQuestions,
    totalPoints: result.newTotalPoints,
    streakDays,
    newStreak,
    droppedCard: result.droppedCard,
    newBadges: result.newBadges,
    shieldAwarded: result.shieldAwarded,
  })
}

// ── Card drop ─────────────────────────────────────────────────────────────

async function dropCard(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  profileId: string,
  yearGroupId: string | null,
): Promise<DroppedCard | null> {
  const rarity = pickRarity()

  // Find published cards for this rarity: year-group-specific OR shared (null)
  const candidates = await tx.cardCatalog.findMany({
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

  // Upsert child_collection
  const existing = await tx.childCollection.findUnique({
    where: { profile_id_card_id: { profile_id: profileId, card_id: card.id } },
  })
  if (existing) {
    await tx.childCollection.update({
      where: { profile_id_card_id: { profile_id: profileId, card_id: card.id } },
      data: { quantity: { increment: 1 } },
    })
  } else {
    await tx.childCollection.create({
      data: { profile_id: profileId, card_id: card.id, quantity: 1 },
    })
  }

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
    // subject_complete and guardian_win not triggered yet (Phase 8/11)

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
