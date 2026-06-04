// GET /api/profile/me
// Returns the authenticated user's profile fields needed for customisation.
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true, display_name: true, avatar_config: true, theme_name: true, study_buddy: true, learning_profile: true, total_points: true, streak_days: true },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const avatarCfg = profile.avatar_config as { base?: string; colour?: string } | null

  return NextResponse.json({
    profile: {
      id:              profile.id,
      displayName:     profile.display_name,
      avatarBase:      avatarCfg?.base   ?? 'explorer',
      avatarColour:    avatarCfg?.colour ?? 'blue',
      theme:           profile.theme_name ?? 'default',
      studyBuddy:      profile.study_buddy,
      learningProfile: profile.learning_profile ?? {},
      totalPoints:     profile.total_points,
      streakDays:      profile.streak_days,
    },
  })
}
