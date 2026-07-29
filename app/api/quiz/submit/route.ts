import { NextResponse } from 'next/server'
import type { Badge } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcQuizPoints, scoreToSm2Quality, scoreQuizAttempt } from '@/lib/points'
import { sm2 } from '@/lib/sm2'
import { rarityForRoundResult, type Rarity } from '@/lib/cards'
import { checkAndUpdateMilestone } from '@/lib/vault/status'
import { recordLearningEvent } from '@/lib/learning-events'
import { getConsentGate, CONSENT_GATE_RESPONSE } from '@/lib/parental-consent'
import { notifyParentBigMoment } from '@/lib/parent-notify'
import { resolveStreak, earnsFreeze, MAX_STREAK_FREEZES } from '@/lib/streak'

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
  if (answers.length > 50) {
    return NextResponse.json({ error: 'Too many answers' }, { status: 400 })
  }

  // Wave 1: profile + correct answers in parallel (correct answers need only topicId, not profile.id)
  const questionIds = answers.map((a) => a.questionId)
  const [profile, correctAnswers] = await Promise.all([
    prisma.profile.findUnique({ where: { user_id: user.id } }),
    prisma.quizQuestion.findMany({
      where:  { id: { in: questionIds }, topic_id: topicId, status: 'published' },
      select: { id: true, correct_answer: true, question_type: true },
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

  // ── Parental-consent soft gate (Children's Code) — quizzes pause when the
  // grace window lapses with no parent confirmation; Learn stays open. ───────
  const consentGate = await getConsentGate(user.id)
  if (consentGate.state === 'gated') {
    return NextResponse.json(CONSENT_GATE_RESPONSE, { status: 422 })
  }
  const correctMap = new Map(correctAnswers.map((q) => [q.id, q.correct_answer]))
  const typeMap    = new Map(correctAnswers.map((q) => [q.id, q.question_type]))

  // Multi-part types cannot be verified by simple string comparison on the server.
  // We trust the client's wasCorrect only when the child actually provided a non-empty answer,
  // preventing fabricated perfect scores from blank submissions.
  const MULTIPART_TYPES = new Set(['true_false_grid', 'ordered_list', 'source_analysis', 'explain_example', 'structured_answer'])

  const scoredAnswers = answers.map((a) => ({
    ...a,
    wasCorrect: MULTIPART_TYPES.has(typeMap.get(a.questionId) ?? '')
      ? Boolean(a.wasCorrect) && typeof a.childAnswer === 'string' && a.childAnswer.trim().length > 0
      : correctMap.get(a.questionId)?.trim().toLowerCase() === a.childAnswer?.trim().toLowerCase(),
  }))
  // ── End server-side scoring ───────────────────────────────────────────────

  // Scored per distinct question with credit falling by try, not per answer row.
  // See scoreQuizAttempt in lib/points.ts for why.
  const {
    totalQuestions,
    correctCount,
    scoreFraction,
    passed,
    hintsUsedCount,
    perfectScore,
  } = scoreQuizAttempt(scoredAnswers)

  const points = calcQuizPoints(scoredAnswers)

  // Freezes are read before the transaction so the streak outcome is decided on
  // the same balance the transaction then adjusts.
  const heldFreezes = (
    await prisma.streakShield.findUnique({
      where: { profile_id: profile.id },
      select: { quantity: true },
    })
  )?.quantity ?? 0

  const streakOutcome = resolveStreak({
    lastActive: profile.last_active,
    streakDays: profile.streak_days,
    freezesAvailable: heldFreezes,
    now: new Date(),
  })
  const streakDays = streakOutcome.streakDays
  const newStreak = streakOutcome.changed

  const result = await prisma.$transaction(async (tx) => {
    // Write quiz_attempt
    const attempt = await tx.quizAttempt.create({
      data: {
        profile_id: profile.id,
        topic_id: topicId,
        score: scoreFraction,
        hints_used: hintsUsedCount,
        time_taken_seconds: timeTakenSeconds ?? 0,
        hearts_remaining: Math.max(0, Math.min(3, heartsRemaining ?? 3)),
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
    } else {
      // A near miss used to record nothing at all: three attempts at 60% left the
      // topic looking untouched on the dashboard and in the parent view. Bank the
      // work as in-progress with the best score so far. SM-2 scheduling stays out
      // of it, since nothing has been learnt well enough to schedule a review, and
      // a topic already completed is never downgraded by a later weak retry.
      const existing = await tx.topicProgress.findUnique({
        where: { profile_id_topic_id: { profile_id: profile.id, topic_id: topicId } },
        select: { status: true, last_score: true },
      })

      if (existing?.status !== 'completed') {
        const bestScore = Math.max(scoreFraction, existing?.last_score ?? 0)
        await tx.topicProgress.upsert({
          where: { profile_id_topic_id: { profile_id: profile.id, topic_id: topicId } },
          create: {
            profile_id: profile.id,
            topic_id: topicId,
            status: 'in_progress',
            last_score: bestScore,
          },
          update: {
            status: 'in_progress',
            last_score: bestScore,
          },
        })
      }
    }

    // Update profile (points + streak + SM-2 in one write)
    await tx.profile.update({
      where: { id: profile.id },
      data: {
        total_points: newTotalPoints,
        sr_easiness: smEasiness,
        streak_days: streakDays,
        last_active: new Date(),
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

    // ── Streak freezes ────────────────────────────────────────────────────
    // Spend first: this round may have been the one that survived a missed day.
    // Clamped at 0 rather than a plain decrement, because the balance was read
    // before the transaction opened and two submissions landing together would
    // otherwise be able to drive it negative.
    if (streakOutcome.freezesUsed > 0) {
      await tx.$executeRaw`
        UPDATE streak_shields
        SET quantity = GREATEST(quantity - ${streakOutcome.freezesUsed}::int, 0)
        WHERE profile_id = ${profile.id}::uuid
      `
    }

    // Then earn. Awarded every third day of a streak and capped at
    // MAX_STREAK_FREEZES held, so a regular player keeps a small buffer.
    // Previously the only source was the one-off Streak 7 badge, which no child
    // has ever reached.
    const freezesAfterSpend = heldFreezes - streakOutcome.freezesUsed
    let shieldAwarded = false
    if (streakOutcome.changed && earnsFreeze(streakDays, freezesAfterSpend)) {
      await tx.$executeRaw`
        INSERT INTO streak_shields (profile_id, quantity)
        VALUES (${profile.id}::uuid, 1)
        ON CONFLICT (profile_id)
        DO UPDATE SET quantity = LEAST(streak_shields.quantity + 1, ${MAX_STREAK_FREEZES}::int)
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
      streakSaved: streakOutcome.streakSaved,
    }
  }, { timeout: 15000 })

  // ── Card drop — runs OUTSIDE the main transaction so quiz results always save ─
  // A failure here logs and returns null; it never breaks the quiz response.
  // See rarityForRoundResult in lib/cards.ts for which round earns what.
  let droppedCard: DroppedCard | null = null
  const rarity = rarityForRoundResult(passed, correctCount)
  if (rarity) {
    try {
      droppedCard = await dropCard(prisma, profile.id, profile.year_group_id, rarity)
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

  // Non-blocking "big moment" email to the linked parent (an adult). One email
  // per submit at most: first-win takes precedence, else the first new badge.
  // notifyParentBigMoment swallows all errors and adds no latency here.
  if (result.isFirstWin) {
    void notifyParentBigMoment(profile.id, profile.display_name, { kind: 'first_win' })
  } else if (result.newBadges.length > 0) {
    void notifyParentBigMoment(profile.id, profile.display_name, { kind: 'badge', badgeName: result.newBadges[0].name })
  }

  return NextResponse.json({
    points,
    passed,
    // `score` is a COUNT of questions answered correctly, kept as-is for the
    // existing callers. `scoreFraction` is the credit-weighted 0–1 value the
    // pass decision is actually made on, exposed so the result screen never has
    // to guess which of the two it is holding.
    score: correctCount,
    scoreFraction,
    totalQuestions,
    totalPoints: result.newTotalPoints,
    streakDays,
    newStreak,
    droppedCard,
    newBadges: result.newBadges,
    shieldAwarded: result.shieldAwarded,
    streakSaved: result.streakSaved,
    isFirstWin: result.isFirstWin,
  })
}

// ── Card drop ─────────────────────────────────────────────────────────────

async function dropCard(
  db: typeof prisma,
  profileId: string,
  yearGroupId: string | null,
  rarity: Rarity,
): Promise<DroppedCard | null> {
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

// Streak resolution, including freezes, lives in lib/streak.ts (resolveStreak).
