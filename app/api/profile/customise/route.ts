// PATCH /api/profile/customise
// Updates avatar_config, theme_name, and study_buddy for the authenticated child.
// Child-only. Parents use their own profile settings elsewhere.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { parseLearningProfile } from '@/lib/onboarding-config'
import {
  HAIR_STYLES, HAIR_COLOURS, SKIN_TONES, EYE_STYLES, ACCESSORIES,
  type AvatarConfig,
} from '@/lib/avatar-catalogue'

const VALID_THEMES  = ['default', 'maths', 'english', 'science', 'night'] as const
const VALID_BUDDIES = ['owl', 'fox', 'robot', 'dragon'] as const
const VALID_OUTFIT_COLOURS = ['#6C9EFF', '#FF8FAB', '#52D9A0', '#FFC107', '#9B59B6', '#FB5A24']

// Derived valid-id sets from catalogue
const VALID_SKIN_TONES  = new Set(SKIN_TONES.map((s) => s.id))
const VALID_HAIR_STYLES = new Set(HAIR_STYLES.map((s) => s.id))
const VALID_HAIR_COLOURS = new Set(HAIR_COLOURS.map((c) => c.id))
const VALID_EYE_STYLES  = new Set(EYE_STYLES.map((e) => e.id))
const VALID_ACCESSORIES = new Set(ACCESSORIES.map((a) => a.id))

type Theme = typeof VALID_THEMES[number]
type Buddy = typeof VALID_BUDDIES[number]

export async function PATCH(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true, role: true, total_points: true },
  })
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    theme?:          string
    studyBuddy?:     string
    avatarConfig?:   unknown
    learningProfile?: unknown
  }

  const updates: Record<string, unknown> = {}

  if (body.learningProfile !== undefined) {
    const parsed = parseLearningProfile(body.learningProfile)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: 422 })
    }
    updates.learning_profile = parsed.value
  }

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

  if (body.avatarConfig !== undefined) {
    const cfg = body.avatarConfig as Partial<AvatarConfig>
    if (!cfg || typeof cfg !== 'object') {
      return NextResponse.json({ error: 'Invalid avatarConfig', code: 'INVALID_AVATAR' }, { status: 422 })
    }

    // Validate each field
    if (!VALID_SKIN_TONES.has(cfg.skinTone!)) {
      return NextResponse.json({ error: 'Invalid skinTone',    code: 'INVALID_AVATAR' }, { status: 422 })
    }
    if (!VALID_HAIR_STYLES.has(cfg.hairStyle!)) {
      return NextResponse.json({ error: 'Invalid hairStyle',   code: 'INVALID_AVATAR' }, { status: 422 })
    }
    if (!VALID_HAIR_COLOURS.has(cfg.hairColour!)) {
      return NextResponse.json({ error: 'Invalid hairColour',  code: 'INVALID_AVATAR' }, { status: 422 })
    }
    if (!VALID_EYE_STYLES.has(cfg.eyeStyle!)) {
      return NextResponse.json({ error: 'Invalid eyeStyle',    code: 'INVALID_AVATAR' }, { status: 422 })
    }
    if (!VALID_ACCESSORIES.has(cfg.accessory!)) {
      return NextResponse.json({ error: 'Invalid accessory',   code: 'INVALID_AVATAR' }, { status: 422 })
    }
    if (!cfg.outfitColour || !VALID_OUTFIT_COLOURS.includes(cfg.outfitColour)) {
      return NextResponse.json({ error: 'Invalid outfitColour', code: 'INVALID_AVATAR' }, { status: 422 })
    }

    // Server-side unlock check — prevent picking locked items by manipulating the client
    const pts = profile.total_points
    const hairStyleDef  = HAIR_STYLES.find((s) => s.id === cfg.hairStyle)
    const hairColourDef = HAIR_COLOURS.find((c) => c.id === cfg.hairColour)
    const eyeStyleDef   = EYE_STYLES.find((e) => e.id === cfg.eyeStyle)
    const accessoryDef  = ACCESSORIES.find((a) => a.id === cfg.accessory)

    if ((hairStyleDef?.unlock?.xp  ?? 0) > pts) return NextResponse.json({ error: 'Hair style not unlocked',  code: 'LOCKED' }, { status: 403 })
    if ((hairColourDef?.unlock?.xp ?? 0) > pts) return NextResponse.json({ error: 'Hair colour not unlocked', code: 'LOCKED' }, { status: 403 })
    if ((eyeStyleDef?.unlock?.xp   ?? 0) > pts) return NextResponse.json({ error: 'Eye style not unlocked',   code: 'LOCKED' }, { status: 403 })
    if ((accessoryDef?.unlock?.xp  ?? 0) > pts) return NextResponse.json({ error: 'Accessory not unlocked',   code: 'LOCKED' }, { status: 403 })

    updates.avatar_config = {
      skinTone:     cfg.skinTone!,
      hairStyle:    cfg.hairStyle!,
      hairColour:   cfg.hairColour!,
      eyeStyle:     cfg.eyeStyle!,
      accessory:    cfg.accessory!,
      outfitColour: cfg.outfitColour!,
    } satisfies AvatarConfig
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await prisma.profile.update({ where: { id: profile.id }, data: updates })
  return NextResponse.json({ ok: true })
}
