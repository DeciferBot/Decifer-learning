// GET /api/admin/efficacy
// Admin-only. First-party learning-efficacy summary over real gameplay data:
// normalised learning gain (Hake's g), mastery rate, time-to-mastery, and
// spaced-review retention. No third-party analytics (Children's Code) — every
// number is derived from quiz_attempts already in the database (see lib/efficacy.ts).
//
// Query params:
//   ?childId=<profile_id>   restrict to one child (else whole cohort)
//   ?sinceDays=<n>          only attempts in the last n days (default: all time)

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import {
  computeTopicMastery,
  computeRetention,
  summariseEfficacy,
  type AttemptInput,
} from '@/lib/efficacy'

export async function GET(req: Request) {
  const denied = await requireAdminApi()
  if (denied) return denied

  const url = new URL(req.url)
  const childId = url.searchParams.get('childId')
  const sinceDays = Number(url.searchParams.get('sinceDays')) || null

  const where: Record<string, unknown> = {}
  if (childId) where.profile_id = childId
  if (sinceDays) {
    where.created_at = { gte: new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) }
  }

  const rows = await prisma.quizAttempt.findMany({
    where,
    select: { profile_id: true, topic_id: true, score: true, created_at: true },
    orderBy: { created_at: 'asc' },
  })

  const attempts: AttemptInput[] = rows.map((r) => ({
    profileId: r.profile_id,
    topicId: r.topic_id,
    score: r.score,
    createdAt: r.created_at,
  }))

  const mastery = computeTopicMastery(attempts)
  const retention = computeRetention(attempts)
  const cohort = summariseEfficacy(mastery, retention)

  // Per-child breakdown so the admin can spot a child who isn't progressing.
  const byChild = new Map<string, AttemptInput[]>()
  for (const a of attempts) {
    const arr = byChild.get(a.profileId)
    if (arr) arr.push(a)
    else byChild.set(a.profileId, [a])
  }
  const perChild = Array.from(byChild.entries()).map(([profileId, childAttempts]) => {
    const m = computeTopicMastery(childAttempts)
    const r = computeRetention(childAttempts)
    return { profileId, ...summariseEfficacy(m, r) }
  })

  return NextResponse.json({
    cohort,
    perChild,
    generatedAt: new Date().toISOString(),
    note: 'Efficacy strengthens as more attempts accumulate; retention needs ≥3-day-spaced re-attempts.',
  })
}
