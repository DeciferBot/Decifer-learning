// GET /api/leaderboard
// Returns family leaderboard — the authenticated child + all siblings linked to the
// same parent, ranked by total_points.
// Visibility gated by parent_controls.leaderboard_visible for each child.
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
    select: { id: true, role: true },
  })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Find all children linked to the same parent(s)
  const parentLinks = await prisma.familyLink.findMany({
    where: { child_user_id: user.id },
    select: { parent_user_id: true },
  })

  const parentUserIds = parentLinks.map((l) => l.parent_user_id)

  // All children of those parents
  const siblingLinks = await prisma.familyLink.findMany({
    where:   { parent_user_id: { in: parentUserIds } },
    include: {
      child: {
        select: {
          id:            true,
          display_name:  true,
          total_points:  true,
          streak_days:   true,
          avatar_config: true,
          parent_controls: { select: { leaderboard_visible: true } },
        },
      },
    },
  })

  // Deduplicate by child profile id; include self even if no parent link
  const profileMap = new Map<string, {
    id: string; displayName: string; totalPoints: number; streakDays: number
    avatarEmoji: string; isMe: boolean
  }>()

  const AVATAR_EMOJI: Record<string, string> = {
    wizard: '🧙', knight: '⚔️', explorer: '🗺️', scientist: '🔬',
    artist: '🎨', athlete: '🏃', musician: '🎵', chef: '👨‍🍳',
  }

  for (const link of siblingLinks) {
    const c = link.child
    if (!c.parent_controls?.leaderboard_visible) continue
    const cfg = c.avatar_config as { base?: string } | null
    profileMap.set(c.id, {
      id:           c.id,
      displayName:  c.display_name,
      totalPoints:  c.total_points,
      streakDays:   c.streak_days,
      avatarEmoji:  AVATAR_EMOJI[cfg?.base ?? ''] ?? '🗺️',
      isMe:         c.id === profile.id,
    })
  }

  // Always include self — but still respect the leaderboard_visible parent control
  if (!profileMap.has(profile.id)) {
    const self = await prisma.profile.findUnique({
      where:  { id: profile.id },
      select: {
        display_name:    true,
        total_points:    true,
        streak_days:     true,
        avatar_config:   true,
        parent_controls: { select: { leaderboard_visible: true } },
      },
    })
    // If a parent explicitly hid this child, honour it even on their own view
    if (self && self.parent_controls?.leaderboard_visible !== false) {
      const cfg = self.avatar_config as { base?: string } | null
      profileMap.set(profile.id, {
        id:           profile.id,
        displayName:  self.display_name,
        totalPoints:  self.total_points,
        streakDays:   self.streak_days,
        avatarEmoji:  AVATAR_EMOJI[cfg?.base ?? ''] ?? '🗺️',
        isMe:         true,
      })
    }
  }

  const entries = [...profileMap.values()].sort((a, b) => b.totalPoints - a.totalPoints)

  return NextResponse.json({ entries })
}
