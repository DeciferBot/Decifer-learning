// POST /api/profile/onboarding
// First-run onboarding for a child: optionally sets avatar, study buddy, theme,
// and non-PII "about me" answers, then stamps onboarded_at so the child is never
// re-prompted. Everything is skippable — an empty body (or { skip: true }) simply
// marks onboarding seen without changing any preferences.
// Child-only.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { parseLearningProfile } from '@/lib/onboarding-config'

const VALID_THEMES   = ['default', 'maths', 'english', 'science', 'night'] as const
const VALID_BUDDIES  = ['owl', 'fox', 'robot', 'dragon'] as const
const VALID_AVATARS  = ['wizard', 'knight', 'explorer', 'scientist', 'artist', 'athlete', 'musician', 'chef'] as const
const VALID_COLOURS  = ['blue', 'pink', 'green', 'gold', 'purple', 'orange'] as const

interface Body {
  avatarBase?:   string
  avatarColour?: string
  studyBuddy?:   string | null
  theme?:        string
  learningProfile?: {
    favourite_subject?: string
    interests?:         string[]
    learn_styles?:      string[]
    confidence?:        Record<string, number>
  }
}

function bad(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 422 })
}

export async function POST(req: Request) {
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

  // Tolerate an empty/skip body — onboarding is fully skippable.
  let body: Body = {}
  try {
    const parsed = await req.json()
    if (parsed && typeof parsed === 'object') body = parsed as Body
  } catch {
    body = {}
  }

  const updates: Record<string, unknown> = {}

  // ── Avatar (both parts required together if either is present) ──────────────
  if (body.avatarBase !== undefined || body.avatarColour !== undefined) {
    if (!body.avatarBase || !body.avatarColour) {
      return bad('Provide both avatarBase and avatarColour', 'INCOMPLETE_AVATAR')
    }
    if (!(VALID_AVATARS as readonly string[]).includes(body.avatarBase)) {
      return bad('Invalid avatar base', 'INVALID_AVATAR')
    }
    if (!(VALID_COLOURS as readonly string[]).includes(body.avatarColour)) {
      return bad('Invalid avatar colour', 'INVALID_COLOUR')
    }
    updates.avatar_config = { base: body.avatarBase, colour: body.avatarColour }
  }

  // ── Study buddy (nullable — null clears it) ─────────────────────────────────
  if (body.studyBuddy !== undefined && body.studyBuddy !== null) {
    if (!(VALID_BUDDIES as readonly string[]).includes(body.studyBuddy)) {
      return bad('Invalid study buddy', 'INVALID_BUDDY')
    }
    updates.study_buddy = body.studyBuddy
  }

  // ── Theme ───────────────────────────────────────────────────────────────────
  if (body.theme !== undefined) {
    if (!(VALID_THEMES as readonly string[]).includes(body.theme)) {
      return bad('Invalid theme', 'INVALID_THEME')
    }
    updates.theme_name = body.theme
  }

  // ── Non-PII learning profile ─────────────────────────────────────────────────
  if (body.learningProfile !== undefined) {
    const parsed = parseLearningProfile(body.learningProfile)
    if ('error' in parsed) return bad(parsed.error, parsed.code)
    if (Object.keys(parsed.value).length > 0) updates.learning_profile = parsed.value
  }

  // Always mark onboarding seen so we never re-prompt — even on a pure skip.
  updates.onboarded_at = new Date()

  await prisma.profile.update({ where: { id: profile.id }, data: updates })
  return NextResponse.json({ ok: true })
}
