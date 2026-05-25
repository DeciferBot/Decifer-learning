// PATCH /api/profile/customise
// Updates avatar_config, theme_name, and study_buddy for the authenticated child.
// Child-only. Parents use their own profile settings elsewhere.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const VALID_THEMES  = ['default', 'maths', 'english', 'science', 'night'] as const
const VALID_BUDDIES = ['owl', 'fox', 'robot', 'dragon'] as const
const VALID_AVATARS = ['wizard', 'knight', 'explorer', 'scientist', 'artist', 'athlete', 'musician', 'chef'] as const
const VALID_COLOURS = ['blue', 'pink', 'green', 'gold', 'purple', 'orange'] as const

type Theme  = typeof VALID_THEMES[number]
type Buddy  = typeof VALID_BUDDIES[number]
type Avatar = typeof VALID_AVATARS[number]
type Colour = typeof VALID_COLOURS[number]

interface AvatarConfig {
  base:   Avatar
  colour: Colour
}

export async function PATCH(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true, role: true },
  })
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    theme?:       string
    studyBuddy?:  string
    avatarBase?:  string
    avatarColour?: string
  }

  const updates: Record<string, unknown> = {}

  if (body.theme !== undefined) {
    if (!(VALID_THEMES as readonly string[]).includes(body.theme)) {
      return NextResponse.json({ error: 'Invalid theme', code: 'INVALID_THEME' }, { status: 422 })
    }
    updates.theme_name = body.theme as Theme
  }

  if (body.studyBuddy !== undefined) {
    if (!(VALID_BUDDIES as readonly string[]).includes(body.studyBuddy)) {
      return NextResponse.json({ error: 'Invalid study buddy', code: 'INVALID_BUDDY' }, { status: 422 })
    }
    updates.study_buddy = body.studyBuddy as Buddy
  }

  if (body.avatarBase !== undefined || body.avatarColour !== undefined) {
    // Must provide both to update avatar
    if (!body.avatarBase || !body.avatarColour) {
      return NextResponse.json({ error: 'Provide both avatarBase and avatarColour', code: 'INCOMPLETE_AVATAR' }, { status: 422 })
    }
    if (!(VALID_AVATARS as readonly string[]).includes(body.avatarBase)) {
      return NextResponse.json({ error: 'Invalid avatar base', code: 'INVALID_AVATAR' }, { status: 422 })
    }
    if (!(VALID_COLOURS as readonly string[]).includes(body.avatarColour)) {
      return NextResponse.json({ error: 'Invalid avatar colour', code: 'INVALID_COLOUR' }, { status: 422 })
    }
    updates.avatar_config = { base: body.avatarBase as Avatar, colour: body.avatarColour as Colour } satisfies AvatarConfig
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await prisma.profile.update({ where: { id: profile.id }, data: updates })
  return NextResponse.json({ ok: true })
}
