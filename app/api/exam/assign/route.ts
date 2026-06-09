import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { canActAsParent } from '@/lib/auth/roles'

type AssignBody = {
  childProfileId: string
  subjectId: string
  yearGroupId: string
  title: string
  topicScope: 'all' | 'weak_areas' | 'selected'
  topicIds?: string[]
  questionCount: number
  timeLimitMinutes: number
  hintsAllowed: boolean
  availableFrom?: string
  availableUntil?: string
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parentProfile = await getCurrentProfile(supabase, user.id)
  if (!parentProfile || !canActAsParent(parentProfile.role)) {
    return NextResponse.json({ error: 'Parent account required' }, { status: 403 })
  }

  const body: AssignBody = await request.json()

  // Verify parent→child link
  const link = await prisma.familyLink.findFirst({
    where: {
      parent_user_id: parentProfile.user_id,
      child_user_id: { not: '' },
    },
    include: { child: { select: { id: true } } },
  })

  const childProfile = await prisma.profile.findUnique({
    where: { id: body.childProfileId },
    select: { id: true, user_id: true },
  })
  if (!childProfile) return NextResponse.json({ error: 'Child not found' }, { status: 404 })

  const validLink = await prisma.familyLink.findFirst({
    where: {
      parent_user_id: parentProfile.user_id,
      child_user_id: childProfile.user_id,
    },
  })
  if (!validLink) return NextResponse.json({ error: 'Not your child' }, { status: 403 })

  const assignment = await prisma.examAssignment.create({
    data: {
      parent_profile_id: parentProfile.id,
      child_profile_id: body.childProfileId,
      subject_id: body.subjectId,
      year_group_id: body.yearGroupId,
      title: body.title,
      topic_scope: body.topicScope,
      topic_ids: body.topicIds ? body.topicIds : undefined,
      question_count: body.questionCount,
      time_limit_minutes: body.timeLimitMinutes,
      hints_allowed: body.hintsAllowed,
      available_from: body.availableFrom ? new Date(body.availableFrom) : null,
      available_until: body.availableUntil ? new Date(body.availableUntil) : null,
    },
  })

  return NextResponse.json({ assignment }, { status: 201 })
}
