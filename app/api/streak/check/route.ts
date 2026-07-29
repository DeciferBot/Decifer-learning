import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { resolveStreak } from '@/lib/streak'

// POST /api/streak/check
// Called from the child home screen on mount to update the streak on daily login.
// Idempotent: multiple calls on the same calendar day are no-ops.
//
// Streak freezes are applied here as well as on quiz submit, so a child who opens
// the app after missing a day keeps their streak whichever route they arrive by.
export async function POST() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true, last_active: true, streak_days: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const shield = await prisma.streakShield.findUnique({
    where: { profile_id: profile.id },
    select: { quantity: true },
  })

  const outcome = resolveStreak({
    lastActive: profile.last_active,
    streakDays: profile.streak_days,
    freezesAvailable: shield?.quantity ?? 0,
    now: new Date(),
  })

  if (!outcome.changed) {
    return NextResponse.json({ streak_days: outcome.streakDays, updated: false, streakSaved: false })
  }

  // One transaction: spending a freeze and keeping the streak it paid for must
  // not be able to come apart.
  await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { id: profile.id },
      data: { streak_days: outcome.streakDays, last_active: new Date() },
    })
    // Clamped at 0: the balance was read before the transaction opened, so two
    // concurrent calls must not be able to drive it negative.
    if (outcome.freezesUsed > 0) {
      await tx.$executeRaw`
        UPDATE streak_shields
        SET quantity = GREATEST(quantity - ${outcome.freezesUsed}::int, 0)
        WHERE profile_id = ${profile.id}::uuid
      `
    }
  })

  return NextResponse.json({
    streak_days: outcome.streakDays,
    updated: true,
    streakSaved: outcome.streakSaved,
    freezesUsed: outcome.freezesUsed,
  })
}
