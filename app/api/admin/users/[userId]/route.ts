// DELETE /api/admin/users/[userId] — removes a user from Supabase auth
//   (cascades to profiles and all gameplay rows).
// PATCH  /api/admin/users/[userId] — corrects a child's year group (e.g. a kid
//   who registered as Y7 but is actually in Y3).
// Protected by the admin password gate.
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { isYearGroupLabel, yearGroupRequiresExamBoard } from '@/lib/auth/roles'

type Params = { params: { userId: string } }

export async function PATCH(req: Request, { params }: Params) {
  const denied = await requireAdminApi()
  if (denied) return denied

  const { userId } = params
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { yearGroup?: unknown }
  if (!isYearGroupLabel(body.yearGroup)) {
    return NextResponse.json({ error: 'Invalid yearGroup', code: 'INVALID_YEAR_GROUP' }, { status: 422 })
  }

  const profile = await prisma.profile.findUnique({
    where: { user_id: userId },
    select: { id: true, role: true },
  })
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (profile.role !== 'child') {
    return NextResponse.json({ error: 'Only child accounts have a year group' }, { status: 422 })
  }

  const yearGroupRow = await prisma.yearGroup.findFirst({ where: { label: body.yearGroup } })
  if (!yearGroupRow) {
    return NextResponse.json({ error: `Year group ${body.yearGroup} not seeded` }, { status: 422 })
  }

  // KS1–KS3 have no exam board; clear a stale one when moving out of KS4.
  const clearsExamBoard = !yearGroupRequiresExamBoard(body.yearGroup)
  await prisma.profile.update({
    where: { id: profile.id },
    data: { year_group_id: yearGroupRow.id, ...(clearsExamBoard ? { exam_board: null } : {}) },
  })

  // Keep auth.users.user_metadata.year_group in sync — role helpers and the
  // signup bridge read year group from metadata.
  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin.auth.admin.getUserById(userId)
  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...(existing?.user?.user_metadata ?? {}),
      year_group: body.yearGroup,
      ...(clearsExamBoard ? { exam_board: null } : {}),
    },
  })
  if (metaError) {
    return NextResponse.json({ error: `Profile updated but auth metadata failed: ${metaError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, yearGroup: body.yearGroup })
}

export async function DELETE(_req: Request, { params }: Params) {
  const denied = await requireAdminApi()
  if (denied) return denied

  const { userId } = params
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Look up the profile id first — needed to cascade through gameplay tables.
  const profile = await prisma.profile.findUnique({ where: { user_id: userId }, select: { id: true } })

  if (profile) {
    // Manually cascade: Prisma schema FK relations lack onDelete:Cascade, so Postgres
    // would block auth.users deletion unless we clear dependent rows first.

    // Optional vault / report tables that may not exist in all environments
    await Promise.allSettled([
      prisma.childVaultStatus.deleteMany({ where: { profile_id: profile.id } }),
      prisma.vaultMilestoneEvent.deleteMany({ where: { profile_id: profile.id } }),
      prisma.rewardRequest.deleteMany({ where: { child_profile_id: profile.id } }),
      prisma.rewardRequest.deleteMany({ where: { parent_profile_id: profile.id } }),
      prisma.vaultParentSettings.deleteMany({
        where: { OR: [{ child_profile_id: profile.id }, { parent_profile_id: profile.id }] },
      }),
      prisma.questionReport.deleteMany({ where: { profile_id: profile.id } }),
    ])

    // Core gameplay rows — ordered to respect FK deps (answers before attempts)
    await prisma.quizAnswer.deleteMany({ where: { attempt: { profile_id: profile.id } } })
    await prisma.$transaction([
      prisma.quizAttempt.deleteMany({ where: { profile_id: profile.id } }),
      prisma.sessionAnswer.deleteMany({ where: { profile_id: profile.id } }),
      prisma.topicProgress.deleteMany({ where: { profile_id: profile.id } }),
      prisma.childCollection.deleteMany({ where: { profile_id: profile.id } }),
      prisma.pointEvent.deleteMany({ where: { profile_id: profile.id } }),
      prisma.profileBadge.deleteMany({ where: { profile_id: profile.id } }),
      prisma.streakShield.deleteMany({ where: { profile_id: profile.id } }),
      prisma.childMission.deleteMany({ where: { profile_id: profile.id } }),
      prisma.parentControl.deleteMany({ where: { child_profile_id: profile.id } }),
      prisma.familyLink.deleteMany({
        where: { OR: [{ parent_user_id: userId }, { child_user_id: userId }] },
      }),
      prisma.profile.delete({ where: { id: profile.id } }),
    ])
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
