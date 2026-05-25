// GET /api/missions — active + recently completed missions for the authenticated child.
// POST /api/missions — create a new mission for the child (auto-generated from progress).

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Mission types and their display config
const MISSION_LABELS: Record<string, { title: (v: number, topic?: string) => string; emoji: string }> = {
  complete_topic:   { emoji: '📖', title: (v, t) => `Complete ${t ?? 'a topic'}` },
  quiz_score:       { emoji: '🎯', title: (v) => `Score ${v}% or higher on a quiz` },
  streak_days:      { emoji: '🔥', title: (v) => `Keep a ${v}-day streak` },
  earn_points:      { emoji: '⭐', title: (v) => `Earn ${v.toLocaleString()} points` },
  collect_cards:    { emoji: '🃏', title: (v) => `Collect ${v} Discovery Cards` },
  complete_topics:  { emoji: '🏆', title: (v) => `Complete ${v} topics` },
}

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true, role: true },
  })
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const missions = await prisma.childMission.findMany({
    where:   { profile_id: profile.id },
    include: { topic: { select: { id: true, title: true } } },
    orderBy: [{ completed_at: 'asc' }, { created_at: 'desc' }],
    take: 20,
  })

  const formatted = missions.map((m) => {
    const cfg = MISSION_LABELS[m.mission_type]
    const topicTitle = m.topic?.title
    return {
      id:           m.id,
      type:         m.mission_type,
      title:        cfg?.title(m.target_value ?? 0, topicTitle) ?? m.mission_type,
      emoji:        cfg?.emoji ?? '🎯',
      targetValue:  m.target_value,
      currentValue: m.current_value,
      targetTier:   m.target_tier,
      completed:    !!m.completed_at,
      completedAt:  m.completed_at,
      createdAt:    m.created_at,
      progress:     m.target_value
        ? Math.min(1, m.current_value / m.target_value)
        : m.completed_at ? 1 : 0,
    }
  })

  return NextResponse.json({ missions: formatted })
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true, role: true, total_points: true, year_group_id: true, streak_days: true },
  })
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Auto-generate 3 missions based on current progress if none active
  const activeMissions = await prisma.childMission.count({
    where: { profile_id: profile.id, completed_at: null },
  })
  if (activeMissions >= 3) {
    return NextResponse.json({ error: 'Already have active missions', code: 'TOO_MANY_MISSIONS' }, { status: 422 })
  }

  // Pick the next topic they haven't completed — scoped to their year group
  const nextTopic = await prisma.topicProgress.findFirst({
    where: {
      profile_id: profile.id,
      status:     { not: 'completed' },
      ...(profile.year_group_id ? { topic: { year_group_id: profile.year_group_id } } : {}),
    },
    select:  { topic_id: true },
    orderBy: { topic_id: 'asc' },
  })

  const toCreate: Array<{
    profile_id:      string
    mission_type:    string
    target_topic_id: string | null
    target_value:    number | null
  }> = []

  if (nextTopic) {
    toCreate.push({
      profile_id:      profile.id,
      mission_type:    'complete_topic',
      target_topic_id: nextTopic.topic_id,
      target_value:    null,
    })
  }

  // Earn-points mission: 500 pts above current total (rounded to nearest 500)
  const pts   = profile.total_points ?? 0
  const target = Math.ceil((pts + 200) / 500) * 500
  toCreate.push({
    profile_id:      profile.id,
    mission_type:    'earn_points',
    target_topic_id: null,
    target_value:    target,
  })

  // Streak mission
  toCreate.push({
    profile_id:      profile.id,
    mission_type:    'streak_days',
    target_topic_id: null,
    target_value:    3,
  })

  const created = await prisma.$transaction(
    toCreate.slice(0, 3 - activeMissions).map((d) =>
      prisma.childMission.create({ data: { ...d, current_value: 0 } }),
    ),
  )

  return NextResponse.json({ created: created.length })
}
