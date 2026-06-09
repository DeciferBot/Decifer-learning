import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { canActAsParent } from '@/lib/auth/roles'

// GET /api/exam/result/[attemptId]
// Accessible by the child who sat it, or the parent who assigned it.
export async function GET(
  _request: Request,
  { params }: { params: { attemptId: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      assignment: {
        include: {
          subject: { select: { name: true, colour_token: true } },
        },
      },
    },
  })
  if (!attempt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Access check: child who sat it, or parent who assigned it
  const isChild = attempt.profile_id === profile.id
  const isParent =
    canActAsParent(profile.role) &&
    attempt.assignment.parent_profile_id === profile.id
  if (!isChild && !isParent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Re-hydrate question texts for the review panel
  const questionIds = (attempt.question_ids as string[]) ?? []
  const questions = await prisma.quizQuestion.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      question_text: true,
      question_type: true,
      correct_answer: true,
      explanation: true,
      distractors: true,
      answer_parts: true,
      topic_id: true,
      topic: { select: { title: true } },
    },
  })
  const questionMap = new Map(questions.map((q) => [q.id, q]))

  type AnswerRecord = {
    questionId: string
    topicId: string
    childAnswer: string
    wasCorrect: boolean
    timeSeconds: number
  }

  const answers = ((attempt.answers as AnswerRecord[]) ?? [])
  const reviewItems = questionIds.map((qid) => {
    const q = questionMap.get(qid)
    const a = answers.find((x) => x.questionId === qid)
    return {
      questionId: qid,
      questionText: q?.question_text ?? '',
      questionType: q?.question_type ?? '',
      correctAnswer: q?.correct_answer ?? '',
      explanation: q?.explanation ?? null,
      distractors: q?.distractors ?? null,
      answerParts: q?.answer_parts ?? null,
      topicId: q?.topic_id ?? '',
      topicTitle: q?.topic.title ?? '',
      childAnswer: a?.childAnswer ?? '',
      wasCorrect: a?.wasCorrect ?? false,
      timeSeconds: a?.timeSeconds ?? 0,
    }
  })

  // Build per-topic breakdown
  const byTopic: Record<string, { topicTitle: string; correct: number; total: number }> = {}
  for (const item of reviewItems) {
    if (!byTopic[item.topicId]) {
      byTopic[item.topicId] = { topicTitle: item.topicTitle, correct: 0, total: 0 }
    }
    byTopic[item.topicId].total++
    if (item.wasCorrect) byTopic[item.topicId].correct++
  }

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      score: attempt.score,
      timeTakenSeconds: attempt.time_taken_seconds,
      startedAt: attempt.started_at,
      completedAt: attempt.completed_at,
    },
    assignment: {
      title: attempt.assignment.title,
      questionCount: attempt.assignment.question_count,
      timeLimitMinutes: attempt.assignment.time_limit_minutes,
      subject: attempt.assignment.subject,
    },
    breakdown: Object.entries(byTopic).map(([topicId, v]) => ({
      topicId,
      ...v,
    })),
    reviewItems,
  })
}
