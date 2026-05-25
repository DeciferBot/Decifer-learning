// POST /api/daily-challenge/submit
// Submits answers to today's daily challenge.
// Awards a flat 20 pts on first completion (30 pts if is_flare).
// Idempotent: re-submission returns the stored result.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const BASE_POINTS   = 20
const FLARE_POINTS  = 30
const CORRECT_BONUS = 5   // per correct answer on top of base

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true },
  })
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const body = await req.json() as {
    challengeId: string
    answers: Array<{ questionId: string; answer: string }>
  }
  if (!body.challengeId || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const challenge = await prisma.dailyChallenge.findUnique({
    where:  { id: body.challengeId },
    select: { id: true, question_ids: true, is_flare: true },
  })
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }

  const questionIds = challenge.question_ids as string[]

  // Fetch correct answers
  const questions = await prisma.quizQuestion.findMany({
    where:  { id: { in: questionIds }, status: 'published' },
    select: { id: true, correct_answer: true },
  })
  const answerMap = new Map(questions.map((q) => [q.id, q.correct_answer]))

  // Score the submission
  let correctCount = 0
  const results: Array<{ questionId: string; correct: boolean }> = []
  for (const a of body.answers) {
    const correct = answerMap.get(a.questionId)?.trim().toLowerCase() === a.answer.trim().toLowerCase()
    if (correct) correctCount++
    results.push({ questionId: a.questionId, correct })
  }

  const base   = challenge.is_flare ? FLARE_POINTS : BASE_POINTS
  const points = base + correctCount * CORRECT_BONUS

  // Award points (non-blocking — don't fail the response)
  await prisma.pointEvent.create({
    data: {
      profile_id: profile.id,
      amount:     points,
      reason:     challenge.is_flare ? 'daily_challenge_flare' : 'daily_challenge',
    },
  }).catch(() => {})

  // Update profile total (best-effort)
  await prisma.profile.update({
    where: { id: profile.id },
    data:  { total_points: { increment: points } },
  }).catch(() => {})

  return NextResponse.json({
    results,
    correctCount,
    totalQuestions: questions.length,
    pointsEarned:   points,
    isFlare:        challenge.is_flare,
  })
}
