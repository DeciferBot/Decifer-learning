import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 404 })

  const body = await req.json()
  const { aidType, topicKey, durationSeconds, askCount } = body

  if (!aidType) return NextResponse.json({ error: 'aidType required' }, { status: 400 })

  await prisma.explorationSession.create({
    data: {
      profile_id: profile.id,
      aid_type: aidType,
      topic_key: topicKey ?? null,
      duration_seconds: durationSeconds ?? 0,
      ask_count: askCount ?? 0,
    },
  })

  return NextResponse.json({ ok: true })
}
