import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const shield = await prisma.streakShield.findUnique({
    where: { profile_id: profile.id },
  })
  if (!shield || shield.quantity <= 0) {
    return NextResponse.json({ error: 'No shields available' }, { status: 409 })
  }

  await prisma.streakShield.update({
    where: { profile_id: profile.id },
    data: { quantity: { decrement: 1 } },
  })

  return NextResponse.json({ quantity: shield.quantity - 1 })
}
