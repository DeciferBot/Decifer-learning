// GET /api/admin/monitoring — pipeline health stats for the admin monitoring page.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth/admin-guard'

export async function GET() {
  // Access is controlled by the admin password gate (middleware enforces it for
  // /api/admin/*; this is defense-in-depth).
  const denied = await requireAdminApi()
  if (denied) return denied

  const [
    questionCounts,
    recentFlags,
    recentActivity,
  ] = await Promise.all([
    prisma.quizQuestion.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.quizQuestion.findMany({
      where:   { status: 'flagged' },
      select:  {
        id: true, question_text: true,
        topic: { select: { title: true, subject: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.quizAttempt.count({
      where: { created_at: { gte: new Date(Date.now() - 7 * 86400_000) } },
    }),
  ])

  // question_reports may not be migrated in all environments — degrade to empty.
  const openReports = await prisma.questionReport.findMany({
    where:   { status: 'open' },
    include: {
      question: { select: { id: true, question_text: true, topic: { select: { title: true } } } },
      profile:  { select: { display_name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 30,
  }).catch(() => [])

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
