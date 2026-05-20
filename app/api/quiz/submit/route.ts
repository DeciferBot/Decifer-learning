import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcQuizPoints, scoreToSm2Quality } from '@/lib/points'
import { sm2 } from '@/lib/sm2'

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

  const points = calcQuizPoints(answers)

  // Streak calculation (done before transaction so we can return it)
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

    // Award points (correct answers always earn, even on fail)
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

    // Update profile (points + streak + SM-2 easiness in one write)
    await tx.profile.update({
      where: { id: profile.id },
      data: {
        total_points: newTotalPoints,
        sr_easiness: smEasiness,
        ...streakProfileUpdate,
      },
    })

    return { newTotalPoints }
  })

  return NextResponse.json({
    points,
    passed,
    score: correctCount,
    totalQuestions,
    totalPoints: result.newTotalPoints,
    streakDays,
    newStreak,
  })
}

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
