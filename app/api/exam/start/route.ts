import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { selectExamQuestions } from '@/lib/exam'

type StartBody = { assignmentId: string }

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Child account required' }, { status: 403 })
  }

  const { assignmentId }: StartBody = await request.json()

  const assignment = await prisma.examAssignment.findUnique({
    where: { id: assignmentId },
  })
  if (!assignment || assignment.child_profile_id !== profile.id) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
  }

  // One-shot: block if already attempted
  const existing = await prisma.examAttempt.findFirst({
    where: { exam_assignment_id: assignmentId, profile_id: profile.id },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'already_attempted', attemptId: existing.id },
      { status: 409 },
    )
  }

  const questions = await selectExamQuestions(assignmentId, profile.id)
  if (questions.length === 0) {
    return NextResponse.json({ error: 'No published questions available' }, { status: 422 })
  }

  const attempt = await prisma.examAttempt.create({
    data: {
      exam_assignment_id: assignmentId,
      profile_id: profile.id,
      question_ids: questions.map((q) => q.id),
      status: 'in_progress',
    },
  })

  // Return questions (including correct_answer for client-side marking,
  // same trust model as QuizShell for non-simple types).
  // Server re-validates on submit.
  return NextResponse.json({
    attemptId: attempt.id,
    startedAt: attempt.started_at,
    timeLimitMinutes: assignment.time_limit_minutes,
    hintsAllowed: assignment.hints_allowed,
    questions,
  })
}
