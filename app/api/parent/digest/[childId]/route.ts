// GET /api/parent/digest/[childId]
// PLI v2 — weekly learning digest for a child.
// Returns a structured summary of the past 7 days: activity, progress, signals.
// Parent-only. Never exposes raw answer data.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole, canActAsParent } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { getSignalsForChild } from '@/lib/learning-signals-runner'

type Params = { params: { childId: string } }

export async function GET(_req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canActAsParent(getUserRole(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const link = await prisma.familyLink.findFirst({
    where: { parent_user_id: user.id, child: { id: params.childId } },
  })
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const [profile, attempts, topicsThisWeek, signals] = await Promise.all([
    prisma.profile.findUnique({
      where:  { id: params.childId },
      select: { display_name: true, total_points: true, streak_days: true },
    }),

    prisma.quizAttempt.findMany({
      where:   { profile_id: params.childId, created_at: { gte: weekAgo } },
      select:  { score: true, hints_used: true, created_at: true, topic: { select: { id: true, title: true, subject: { select: { name: true } } } } },
      orderBy: { created_at: 'asc' },
    }),

    prisma.topicProgress.findMany({
      where:   { profile_id: params.childId, completed_at: { gte: weekAgo } },
      include: { topic: { include: { subject: { select: { name: true } } } } },
    }),

    getSignalsForChild(params.childId),
  ])

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Points earned this week (from point_events)
  const { _sum: pointsSum } = await prisma.pointEvent.aggregate({
    where:  { profile_id: params.childId, created_at: { gte: weekAgo } },
    _sum:   { amount: true },
  })
  const pointsThisWeek = pointsSum.amount ?? 0

  // Quiz stats
  const passRate = attempts.length > 0
    ? Math.round((attempts.filter((a) => a.score >= 0.7).length / attempts.length) * 100)
    : null

  const avgScore = attempts.length > 0
    ? Math.round((attempts.reduce((s, a) => s + a.score, 0) / attempts.length) * 100)
    : null

  // Active days this week
  const activeDays = new Set(attempts.map((a) => a.created_at.toISOString().slice(0, 10))).size

  // Top 3 actionable signals
  const topSignals = signals.slice(0, 3).map((s) => ({
    title:             s.title,
    recommendedAction: s.recommendedAction,
    confidence:        s.confidence,
    signalType:        s.signalType,
  }))

  // Topics completed this week
  const completedTopics = topicsThisWeek.map((tp) => ({
    topicTitle:  tp.topic.title,
    subjectName: tp.topic.subject.name,
    score:       tp.last_score !== null ? Math.round(tp.last_score * 100) : null,
  }))

  return NextResponse.json({
    digest: {
      childName:       profile.display_name,
      weekStart:       weekAgo.toISOString().slice(0, 10),
      weekEnd:         new Date().toISOString().slice(0, 10),
      // Activity
      quizAttempts:    attempts.length,
      activeDays,
      passRate,
      avgScore,
      pointsThisWeek,
      streakDays:      profile.streak_days,
      totalPoints:     profile.total_points,
      // Progress
      topicsCompleted: completedTopics,
      // Signals (top 3, no diagnosis language)
      signals:         topSignals,
      // Summary copy
      summary:         buildSummary(profile.display_name, attempts.length, activeDays, completedTopics.length, pointsThisWeek),
    },
  })
}

function buildSummary(name: string, attempts: number, days: number, topics: number, points: number): string {
  if (attempts === 0) return `${name} hasn't done any quizzes this week, so maybe check in with them about starting a topic.`
  const daysWord = days === 1 ? '1 day' : `${days} days`
  const topicNote = topics > 0 ? ` and completed ${topics} topic${topics > 1 ? 's' : ''}` : ''
  return `${name} was active on ${daysWord} this week${topicNote}, earning ${points.toLocaleString()} points.`
}
