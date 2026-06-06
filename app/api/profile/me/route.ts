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

  const rawCfg = profile.avatar_config as Record<string, unknown> | null

  const LEGACY_COLOUR_HEX: Record<string, string> = {
    blue: '#6C9EFF', pink: '#FF8FAB', green: '#52D9A0',
    gold: '#FFC107', purple: '#9B59B6', orange: '#FB5A24',
  }

  // Detect new AvatarConfig format (has skinTone) vs legacy { base, colour }
  const avatarConfig = rawCfg && 'skinTone' in rawCfg
    ? rawCfg
    : {
        skinTone:     'medium',
        hairStyle:    'short',
        hairColour:   'brown',
        eyeStyle:     'round',
        accessory:    'none',
        outfitColour: LEGACY_COLOUR_HEX[(rawCfg?.colour as string) ?? 'blue'] ?? '#6C9EFF',
      }

  return NextResponse.json({
    profile: {
      id:              profile.id,
      displayName:     profile.display_name,
      avatarConfig,
      theme:           profile.theme_name ?? 'default',
      studyBuddy:      profile.study_buddy,
      learningProfile: profile.learning_profile ?? {},
      totalPoints:     profile.total_points,
      streakDays:      profile.streak_days,
    },
  })
}
