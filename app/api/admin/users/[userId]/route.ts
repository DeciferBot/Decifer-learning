// DELETE /api/admin/users/[userId]
// Deletes a user from Supabase auth (cascades to profiles and all gameplay rows).
// Protected by the admin password gate.

import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'

type Params = { params: { userId: string } }

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
