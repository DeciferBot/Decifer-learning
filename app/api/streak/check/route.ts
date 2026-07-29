import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { displayedStreak, streakAtRisk } from '@/lib/streak'

// POST /api/streak/check
// Called from the child home screen on mount.
//
// This used to ADVANCE the streak, which meant a child could open the app, tap
// nothing, close it, and keep the streak — so the number measured nothing but
// page loads. The streak now moves only when a round is finished, in
// /api/quiz/submit and /api/daily-challenge/submit via applyRoundToStreak.
//
// What this still does:
//   - records last_active, which is "opened the app" and feeds the admin
//     activity counts, the engagement funnel and the comeback nudge
//   - reports the streak's real current worth, so the home screen never shows a
//     9-day streak to a child who last played a fortnight ago
//
// It never writes streak_days and never spends a freeze.
export async function POST() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true, last_round_on: true, streak_days: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const shield = await prisma.streakShield.findUnique({
    where: { profile_id: profile.id },
    select: { quantity: true },
  })

  const now = new Date()
  const opts = {
    lastRoundOn: profile.last_round_on,
    streakDays: profile.streak_days,
    freezesAvailable: shield?.quantity ?? 0,
    now,
  }

  // Presence only. Never fails the response: a child opening the app must not
  // see an error because an analytics timestamp could not be written.
  await prisma.profile
    .update({ where: { id: profile.id }, data: { last_active: now } })
    .catch(() => null)

  return NextResponse.json({
    streak_days: displayedStreak(opts),
    at_risk: streakAtRisk(opts),
    // The streak is never advanced here; only a finished round does that.
    updated: false,
  })
}
