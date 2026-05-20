import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ quantity: 0 })

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!profile) return NextResponse.json({ quantity: 0 })

  const shield = await prisma.streakShield.findUnique({
    where: { profile_id: profile.id },
  })
  return NextResponse.json({ quantity: shield?.quantity ?? 0 })
}
