// PATCH /api/profile/year-group  { yearGroup, examBoard? }
// Lets a child correct their own school year (e.g. registered as Y7 but is in
// Y3). Updates profiles.year_group_id and keeps auth user_metadata in sync.
// KS4 (Y10/Y11) requires an exam board; moving out of KS4 clears it.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { isYearGroupLabel, isExamBoard, yearGroupRequiresExamBoard } from '@/lib/auth/roles'

export async function PATCH(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true, role: true, year_group_changed_at: true },
  })
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Cooldown: one self-service change per 7 days. Stops year-group hopping
  // while still letting a kid fix a signup mistake. Admins are exempt via
  // PATCH /api/admin/users/[userId].
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
  if (
    profile.year_group_changed_at &&
    Date.now() - profile.year_group_changed_at.getTime() < COOLDOWN_MS
  ) {
    return NextResponse.json(
      {
        error: 'You changed your year group recently. Ask a parent or admin if it needs fixing again.',
        code: 'YEAR_GROUP_COOLDOWN',
      },
      { status: 429 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as { yearGroup?: unknown; examBoard?: unknown }
  if (!isYearGroupLabel(body.yearGroup)) {
    return NextResponse.json({ error: 'Invalid year group', code: 'INVALID_YEAR_GROUP' }, { status: 422 })
  }

  const needsExamBoard = yearGroupRequiresExamBoard(body.yearGroup)
  if (needsExamBoard && !isExamBoard(body.examBoard)) {
    return NextResponse.json(
      { error: 'Choose your exam board for GCSE subjects', code: 'EXAM_BOARD_REQUIRED' },
      { status: 422 },
    )
  }

  const yearGroupRow = await prisma.yearGroup.findFirst({ where: { label: body.yearGroup } })
  if (!yearGroupRow) {
    return NextResponse.json({ error: 'Year group not available yet' }, { status: 422 })
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      year_group_id: yearGroupRow.id,
      exam_board: needsExamBoard ? (body.examBoard as string) : null,
      year_group_changed_at: new Date(),
    },
  })

  // Keep auth metadata in sync — role helpers read year group from it.
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      year_group: body.yearGroup,
      exam_board: needsExamBoard ? body.examBoard : null,
    },
  })
  if (metaError) {
    return NextResponse.json(
      { error: `Saved, but session metadata failed to update: ${metaError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, yearGroup: body.yearGroup })
}
