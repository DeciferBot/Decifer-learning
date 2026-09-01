import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { scoreExamAnswers, examPointsAwarded, type ExamAnswerRecord } from '@/lib/exam'
import { MULTIPART_TYPES } from '@/lib/points'

type SubmitBody = {
  attemptId: string
  answers: ExamAnswerRecord[]
  timeTakenSeconds: number
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Child account required' }, { status: 403 })
  }

  const { attemptId, answers, timeTakenSeconds }: SubmitBody = await request.json()

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { assignment: true },
  })
  if (!attempt || attempt.profile_id !== profile.id) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
  }
  if (attempt.status !== 'in_progress') {
    return NextResponse.json({ error: 'Attempt already closed' }, { status: 409 })
  }

  // Time validation: if child took more than timeLimitMinutes + 2 min grace → timed_out
  const limitSeconds = attempt.assignment.time_limit_minutes * 60
  const timedOut = timeTakenSeconds > limitSeconds + 120

  // Server-side scoring: re-fetch correct answers for simple question types
  const questionIds = (attempt.question_ids as string[]) ?? []
  const dbQuestions = await prisma.quizQuestion.findMany({
    where: { id: { in: questionIds }, status: 'published' },
    select: { id: true, correct_answer: true, question_type: true, topic_id: true, topic: { select: { title: true } } },
  })
  const questionMap = new Map(dbQuestions.map((q) => [q.id, q]))

  // Which answers the server re-checks for itself rather than taking the browser's
  // word for it.
  //
  // This used to be a list of five names — 'multiple_choice', 'true_false',
  // 'fill_blank', 'short_answer', 'numeric' — and NOT ONE question in the database
  // has ever carried any of them. So the check never ran on anything, and every
  // exam result was whatever the browser said it was. Turned around: the browser is
  // trusted ONLY for the shapes it alone can mark, which is the same rule the main
  // quiz uses, and everything else is checked here.

  const scoredAnswers: ExamAnswerRecord[] = answers.map((a) => {
    const q = questionMap.get(a.questionId)
    if (!q) return a
    if (MULTIPART_TYPES.has(q.question_type)) {
      // Several parts to one answer; only the browser saw them all. A blank answer
      // is still wrong, so nothing can claim a mark for doing nothing.
      const answered = typeof a.childAnswer === 'string' && a.childAnswer.trim().length > 0
      return { ...a, wasCorrect: answered && Boolean(a.wasCorrect), topicId: a.topicId || q.topic_id }
    }
    const wasCorrect =
      a.childAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    return { ...a, wasCorrect, topicId: q.topic_id }
  })

  // Mark unanswered questions as incorrect
  const answeredIds = new Set(scoredAnswers.map((a) => a.questionId))
  for (const qid of questionIds) {
    if (!answeredIds.has(qid)) {
      const q = questionMap.get(qid)
      scoredAnswers.push({
        questionId: qid,
        topicId: q?.topic_id ?? '',
        childAnswer: '',
        wasCorrect: false,
        timeSeconds: 0,
      })
    }
  }

  // Attach topic titles to breakdown
  const { score, correct, total, breakdown } = scoreExamAnswers(scoredAnswers)
  const topicTitles = new Map(dbQuestions.map((q) => [q.topic_id, q.topic.title]))
  for (const b of breakdown) {
    b.topicTitle = topicTitles.get(b.topicId) ?? b.topicId
  }

  const points = timedOut ? 0 : examPointsAwarded(correct)
  const finalStatus = timedOut ? 'timed_out' : 'completed'

  await prisma.$transaction(async (tx) => {
    await tx.examAttempt.update({
      where: { id: attemptId },
      data: {
        completed_at: new Date(),
        time_taken_seconds: timeTakenSeconds,
        score,
        status: finalStatus,
        answers: scoredAnswers as object[],
      },
    })

    if (points > 0) {
      await tx.pointEvent.create({
        data: {
          profile_id: profile.id,
          amount: points,
          reason: `exam:${attempt.assignment.id}`,
        },
      })
      await tx.profile.update({
        where: { id: profile.id },
        data: { total_points: { increment: points } },
      })
    }
  })

  return NextResponse.json({
    score,
    correct,
    total,
    timeTakenSeconds,
    points,
    timedOut,
    breakdown,
  })
}
