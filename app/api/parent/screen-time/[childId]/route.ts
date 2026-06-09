// GET  /api/parent/screen-time/[childId] — read current screen-time settings
// PATCH /api/parent/screen-time/[childId] — update screen-time settings

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole, canActAsParent } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

type Params = { params: { childId: string } }

async function verifyParentChild(parentUserId: string, childId: string) {
  return prisma.familyLink.findFirst({
    where: { parent_user_id: parentUserId, child: { id: childId } },
  })
}

export async function GET(_req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canActAsParent(getUserRole(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const link = await verifyParentChild(user.id, params.childId)
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const controls = await prisma.parentControl.findUnique({
    where: { child_profile_id: params.childId },
  })

  return NextResponse.json({
    settings: {
      dailyTimeLimitMinutes:  controls?.daily_time_limit_minutes ?? 60,
      allowedTimeStart:       controls?.allowed_time_start ?? null,
      allowedTimeEnd:         controls?.allowed_time_end ?? null,
      leaderboardVisible:     controls?.leaderboard_visible ?? true,
    },
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canActAsParent(getUserRole(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const link = await verifyParentChild(user.id, params.childId)
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    dailyTimeLimitMinutes?: number
    leaderboardVisible?:    boolean
  }

  const data: Record<string, unknown> = {}

  if (body.dailyTimeLimitMinutes !== undefined) {
    const mins = Number(body.dailyTimeLimitMinutes)
    if (!Number.isInteger(mins) || mins < 5 || mins > 480) {
      return NextResponse.json({ error: 'dailyTimeLimitMinutes must be 5–480', code: 'INVALID_LIMIT' }, { status: 422 })
    }
    data.daily_time_limit_minutes = mins
  }

  if (body.leaderboardVisible !== undefined) {
    data.leaderboard_visible = !!body.leaderboardVisible
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await prisma.parentControl.upsert({
    where:  { child_profile_id: params.childId },
    create: { child_profile_id: params.childId, ...data },
    update: data,
  })

  return NextResponse.json({ ok: true })
}
