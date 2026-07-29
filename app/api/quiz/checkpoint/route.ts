import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { scoreAnswers, scoreQuizAttempt } from '@/lib/points'

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
  if (answers.length > 50) {
    return NextResponse.json({ error: 'Too many answers' }, { status: 400 })
  }

  const [profile, answerKey] = await Promise.all([
    prisma.profile.findUnique({ where: { user_id: user.id }, select: { id: true } }),
    prisma.quizQuestion.findMany({
      where: { id: { in: answers.map((a) => a.questionId) }, topic_id: topicId, status: 'published' },
      select: { id: true, correct_answer: true, question_type: true },
    }),
  ])
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // ── Server-side verification — never trust the client's wasCorrect ────────
  // The attempt row feeds IRT calibration and the nightly anomaly detection,
  // so a fabricated score would poison both.
  const scoredAnswers = scoreAnswers(answers, answerKey)
  // ── End server-side verification ──────────────────────────────────────────

  // Scored per distinct question with credit falling by try, matching
  // /api/quiz/submit. Dividing correct rows by total rows counted a wrong first
  // try as an extra failed question, so retrying pushed the score down.
  const { scoreFraction: score } = scoreQuizAttempt(scoredAnswers)
  // 2 of 3 to pass. The line sits at 0.66 because 2/3 is 0.6667: at the old
  // 0.67 a genuine 2-of-3 fell just under and only a clean sweep passed.
  const passed = score >= 0.66

  // Record the attempt (type checkpoint distinguishes from regular quiz attempts in analytics)
  const attempt = await prisma.quizAttempt.create({
    data: {
      profile_id: profile.id,
      topic_id: topicId,
      score,
      hints_used: scoredAnswers.reduce((sum, a) => sum + a.hintNumber, 0),
      time_taken_seconds: timeTakenSeconds,
      hearts_remaining: heartsRemaining,
    },
  })

  await prisma.quizAnswer.createMany({
    data: scoredAnswers.map((a) => ({
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
    // `score` here has always been the 0–1 fraction, unlike /api/quiz/submit
    // where it is a count. scoreFraction is the unambiguous field; both are sent
    // so existing callers of either shape keep working.
    score,
    scoreFraction: score,
    totalQuestions: new Set(answers.map((a) => a.questionId)).size,
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
