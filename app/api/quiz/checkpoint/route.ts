import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Lightweight submit for zone checkpoints — records the attempt but does NOT:
// - Award cards, badges, or points (checkpoints are assessment gates, not rewards)
// - Update topic_progress (the topic was already completed before the checkpoint)
// Returns: { passed, score, totalQuestions }

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

  const [profile] = await Promise.all([
    prisma.profile.findUnique({ where: { user_id: user.id }, select: { id: true } }),
  ])
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const correct = answers.filter((a) => a.wasCorrect).length
  const score = correct / answers.length
  const passed = score >= 0.67 // 2/3 to pass a 3-question checkpoint

  // Record the attempt (type checkpoint distinguishes from regular quiz attempts in analytics)
  const attempt = await prisma.quizAttempt.create({
    data: {
      profile_id: profile.id,
      topic_id: topicId,
      score,
      hints_used: answers.reduce((sum, a) => sum + a.hintNumber, 0),
      time_taken_seconds: timeTakenSeconds,
      hearts_remaining: heartsRemaining,
    },
  })

  await prisma.quizAnswer.createMany({
    data: answers.map((a) => ({
      attempt_id: attempt.id,
      question_id: a.questionId,
      child_answer: a.childAnswer,
      was_correct: a.wasCorrect,
      hint_number: a.hintNumber,
      time_seconds: a.timeSeconds,
    })),
  })

  return NextResponse.json({
    passed,
    score,
    totalQuestions: answers.length,
    // Null values satisfy the QuizShell SubmitResult type
    points: null,
    totalPoints: null,
    streakDays: null,
    newStreak: false,
    droppedCard: null,
    newBadges: [],
    shieldAwarded: false,
  })
}
