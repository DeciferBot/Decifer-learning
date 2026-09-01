// PATCH /api/parent/year-group/[childId]  { yearGroup, examBoard? }
//
// Lets a parent set the school year for a child they are linked to. The child
// can already fix their own year (PATCH /api/profile/year-group), but that path
// has a 7-day cooldown and assumes the child noticed. In September a parent is
// the one who knows which class their child walked into.
//
// Deliberately no cooldown here: the parent is the trusted adult on the account,
// and September is exactly when several corrections in a row are legitimate.
//
// KS4 (Y10/Y11) requires an exam board; moving out of KS4 clears a stale one.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import {
  getUserRole,
  canActAsParent,
  isYearGroupLabel,
  isExamBoard,
  yearGroupRequiresExamBoard,
} from '@/lib/auth/roles'

type Params = { params: { childId: string } }

export async function PATCH(req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canActAsParent(getUserRole(user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // The child must be linked to this parent. Scoping on the link is what stops
  // one family reading or writing another family's children.
  const child = await prisma.profile.findFirst({
    where: {
      id: params.childId,
      role: 'child',
      family_as_child: { some: { parent_user_id: user.id } },
    },
    select: { id: true, user_id: true },
  })
  if (!child) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as {
    yearGroup?: unknown
    examBoard?: unknown
  }

  if (!isYearGroupLabel(body.yearGroup)) {
    return NextResponse.json(
      { error: 'Pick a school year', code: 'INVALID_YEAR_GROUP' },
      { status: 422 },
    )
  }

  const needsExamBoard = yearGroupRequiresExamBoard(body.yearGroup)
  if (needsExamBoard && !isExamBoard(body.examBoard)) {
    return NextResponse.json(
      { error: 'Choose an exam board for GCSE years', code: 'EXAM_BOARD_REQUIRED' },
      { status: 422 },
    )
  }

  const yearGroupRow = await prisma.yearGroup.findFirst({
    where: { label: body.yearGroup },
    select: { id: true },
  })
  if (!yearGroupRow) {
    return NextResponse.json({ error: 'That school year is not available yet' }, { status: 422 })
  }

  await prisma.profile.update({
    where: { id: child.id },
    data: {
      year_group_id: yearGroupRow.id,
      exam_board: needsExamBoard ? (body.examBoard as string) : null,
    },
  })

  // The signup bridge and some role helpers read the year group from the
  // child's auth metadata, so it has to move too or the two disagree.
  const admin = createSupabaseAdminClient()
  const { data: existing } = await admin.auth.admin.getUserById(child.user_id)
  const { error: metaError } = await admin.auth.admin.updateUserById(child.user_id, {
    user_metadata: {
      ...(existing?.user?.user_metadata ?? {}),
      year_group: body.yearGroup,
      exam_board: needsExamBoard ? body.examBoard : null,
    },
  })
  if (metaError) {
    return NextResponse.json(
      { error: `Saved, but the sign-in record did not update: ${metaError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, yearGroup: body.yearGroup })
}
