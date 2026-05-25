// GET /api/daily-challenge/today
// Returns today's daily challenge for the authenticated child's year group.
// Falls back gracefully if no challenge is seeded for today.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true, year_group_id: true },
  })
  if (!profile?.year_group_id) {
    return NextResponse.json({ challenge: null })
  }

  // Today's date in UK timezone (UTC+0/+1), stored as DATE
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const challenge = await prisma.dailyChallenge.findFirst({
    where: {
      year_group_id: profile.year_group_id,
      date:          today,
    },
    select: { id: true, question_ids: true, is_flare: true, date: true },
  })

  if (!challenge) {
    return NextResponse.json({ challenge: null })
  }

  const questionIds = challenge.question_ids as string[]

  // Fetch questions — published only
  const questions = await prisma.quizQuestion.findMany({
    where:  { id: { in: questionIds }, status: 'published' },
    select: {
      id: true,
      question_text: true,
      question_type: true,
      // correct_answer intentionally omitted — scored server-side in /submit
      distractors: true,
      hint_1: true,
      tier: true,
    },
  })

  // Preserve the seeded order
  const ordered = questionIds
    .map((qid) => questions.find((q) => q.id === qid))
    .filter(Boolean)

  return NextResponse.json({
    challenge: {
      id:       challenge.id,
      date:     challenge.date,
      isFlare:  challenge.is_flare,
      questions: ordered,
    },
  })
}
