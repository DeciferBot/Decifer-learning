import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST /api/streak/check
// Called from the child dashboard on mount to update streak on daily login.
// Idempotent: multiple calls on the same calendar day are no-ops.
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

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const lastStr = profile.last_active?.toISOString().slice(0, 10)

  if (lastStr === todayStr) {
    return NextResponse.json({ streak_days: profile.streak_days, updated: false })
  }

  let newStreak: number
  if (lastStr) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    newStreak = lastStr === yesterdayStr ? profile.streak_days + 1 : 1
  } else {
    newStreak = 1
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { streak_days: newStreak, last_active: now },
  })

  return NextResponse.json({ streak_days: newStreak, updated: true })
}
