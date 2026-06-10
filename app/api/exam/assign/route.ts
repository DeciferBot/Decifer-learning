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

const SCOPES = ['all', 'weak_areas', 'selected'] as const

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parentProfile = await getCurrentProfile(supabase, user.id)
  if (!parentProfile || !canActAsParent(parentProfile.role)) {
    return NextResponse.json({ error: 'Parent account required' }, { status: 403 })
  }

  let body: AssignBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.childProfileId || !body.subjectId || !body.yearGroupId) {
    return NextResponse.json({ error: 'Missing child, subject, or year group' }, { status: 400 })
  }
  if (!SCOPES.includes(body.topicScope)) {
    return NextResponse.json({ error: 'Invalid topic scope' }, { status: 400 })
  }
  const questionCount = Number(body.questionCount)
  const timeLimitMinutes = Number(body.timeLimitMinutes)
  if (!Number.isInteger(questionCount) || questionCount < 5 || questionCount > 50) {
    return NextResponse.json({ error: 'Question count must be between 5 and 50' }, { status: 400 })
  }
  if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 5 || timeLimitMinutes > 120) {
    return NextResponse.json({ error: 'Time limit must be between 5 and 120 minutes' }, { status: 400 })
  }

  try {
    const childProfile = await prisma.profile.findUnique({
      where: { id: body.childProfileId },
      select: { id: true, user_id: true },
    })
    if (!childProfile) return NextResponse.json({ error: 'Child not found' }, { status: 404 })

    // Verify parent→child link
    const validLink = await prisma.familyLink.findFirst({
      where: {
        parent_user_id: parentProfile.user_id,
        child_user_id: childProfile.user_id,
      },
    })
    if (!validLink) return NextResponse.json({ error: 'Not your child' }, { status: 403 })

    // Validate selected topics: must be published topics of this subject + year
    // group, and the pool must contain at least one published question.
    let topicIds: string[] | undefined
    if (body.topicScope === 'selected') {
      if (!Array.isArray(body.topicIds) || body.topicIds.length === 0) {
        return NextResponse.json({ error: 'Pick at least one topic' }, { status: 400 })
      }
      const validTopics = await prisma.topic.findMany({
        where: {
          id: { in: body.topicIds },
          subject_id: body.subjectId,
          year_group_id: body.yearGroupId,
          is_published: true,
        },
        select: { id: true },
      })
      topicIds = validTopics.map((t) => t.id)
      if (topicIds.length === 0) {
        return NextResponse.json({ error: 'No valid topics in selection' }, { status: 400 })
      }
      const questionCountInPool = await prisma.quizQuestion.count({
        where: { topic_id: { in: topicIds }, status: 'published' },
      })
      if (questionCountInPool === 0) {
        return NextResponse.json(
          { error: 'No published questions available for the selected topics yet' },
          { status: 422 },
        )
      }
    }

    const assignment = await prisma.examAssignment.create({
      data: {
        parent_profile_id: parentProfile.id,
        child_profile_id: body.childProfileId,
        subject_id: body.subjectId,
        year_group_id: body.yearGroupId,
        title: body.title?.trim() || 'Revision exam',
        topic_scope: body.topicScope,
        topic_ids: topicIds,
        question_count: questionCount,
        time_limit_minutes: timeLimitMinutes,
        hints_allowed: Boolean(body.hintsAllowed),
        available_from: body.availableFrom ? new Date(body.availableFrom) : null,
        available_until: body.availableUntil ? new Date(body.availableUntil) : null,
      },
    })

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (e) {
    console.error('[exam/assign] failed:', e)
    return NextResponse.json({ error: 'Could not create the exam. Please try again.' }, { status: 500 })
  }
}
