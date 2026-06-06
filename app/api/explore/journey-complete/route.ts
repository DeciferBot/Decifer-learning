import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findFirst({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Award 200 points for completing the journey
  await prisma.pointEvent.create({
    data: { profile_id: profile.id, amount: 200, reason: 'solar_journey_complete' },
  })
  await prisma.profile.update({
    where: { id: profile.id },
    data: { total_points: { increment: 200 } },
  })

  // Award badge if it exists and not already earned
  const badge = await prisma.badge.findFirst({
    where: { trigger_rule: { path: ['type'], equals: 'solar_journey_complete' } },
  })
  let badgeAwarded = false
  if (badge) {
    const existing = await prisma.profileBadge.findUnique({
      where: { profile_id_badge_id: { profile_id: profile.id, badge_id: badge.id } },
    })
    if (!existing) {
      await prisma.profileBadge.create({
        data: { profile_id: profile.id, badge_id: badge.id },
      })
      badgeAwarded = true
    }
  }

  return NextResponse.json({ pointsAwarded: 200, badgeAwarded })
}
