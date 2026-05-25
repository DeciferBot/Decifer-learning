// GET /api/admin/monitoring — pipeline health stats for the admin monitoring page.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin check via profiles table — user_metadata.role is user-writable and cannot be trusted
  const adminProfile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { role: true },
  })
  if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [
    questionCounts,
    recentFlags,
    openReports,
    recentActivity,
  ] = await Promise.all([
    // Question status breakdown
    prisma.quizQuestion.groupBy({
      by:     ['status'],
      _count: { _all: true },
    }),

    // Flagged questions (most recent first)
    prisma.quizQuestion.findMany({
      where:   { status: 'flagged' },
      select:  {
        id: true, question_text: true,
        topic: { select: { title: true, subject: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),

    // Open child reports
    prisma.questionReport.findMany({
      where:   { status: 'open' },
      include: {
        question: { select: { id: true, question_text: true, topic: { select: { title: true } } } },
        profile:  { select: { display_name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 30,
    }),

    // Last 7 days quiz activity
    prisma.quizAttempt.count({
      where: { created_at: { gte: new Date(Date.now() - 7 * 86400_000) } },
    }),
  ])

  const countMap = Object.fromEntries(questionCounts.map((r) => [r.status, r._count._all]))

  return NextResponse.json({
    questionStats: {
      published:    countMap.published    ?? 0,
      staged:       countMap.staged       ?? 0,
      flagged:      countMap.flagged      ?? 0,
      regenerating: countMap.regenerating ?? 0,
    },
    flaggedQuestions: recentFlags.map((q) => ({
      id:            q.id,
      questionText:  q.question_text,
      topicTitle:    q.topic.title,
      subjectName:   q.topic.subject.name,
    })),
    openReports: openReports.map((r) => ({
      id:            r.id,
      questionId:    r.question.id,
      questionText:  r.question.question_text,
      topicTitle:    r.question.topic.title,
      childName:     r.profile.display_name,
      reason:        r.reason,
      createdAt:     r.created_at,
    })),
    recentActivity7d: recentActivity,
  })
}
