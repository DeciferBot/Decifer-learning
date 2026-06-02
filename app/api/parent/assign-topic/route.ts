// POST /api/parent/assign-topic   — create a parent_assigned mission for a linked child
// DELETE /api/parent/assign-topic — remove that assignment

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'

async function verifyParentChildLink(parentUserId: string, childProfileId: string) {
  const childProfile = await prisma.profile.findUnique({
    where: { id: childProfileId },
    select: { user_id: true },
  })
  if (!childProfile) return false

  const link = await prisma.familyLink.findFirst({
    where: { parent_user_id: parentUserId, child_user_id: childProfile.user_id },
  })
  return !!link
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parentProfile = await getCurrentProfile(supabase, user.id)
  if (!parentProfile || parentProfile.role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const { childProfileId, topicId } = body ?? {}
  if (!childProfileId || !topicId) {
    return NextResponse.json({ error: 'childProfileId and topicId are required' }, { status: 400 })
  }

  if (!(await verifyParentChildLink(user.id, childProfileId))) {
    return NextResponse.json({ error: 'Not linked to this child' }, { status: 403 })
  }

  // Verify topic exists and is published
  const topic = await prisma.topic.findUnique({
    where:  { id: topicId },
    select: { id: true, title: true, is_published: true },
  })
  if (!topic || !topic.is_published) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Upsert: if an active parent_assigned mission already exists, return it
  const existing = await prisma.childMission.findFirst({
    where: {
      profile_id:      childProfileId,
      mission_type:    'parent_assigned',
      target_topic_id: topicId,
      completed_at:    null,
    },
  })
  if (existing) {
    return NextResponse.json({ mission: existing, created: false })
  }

  const mission = await prisma.childMission.create({
    data: {
      profile_id:      childProfileId,
      mission_type:    'parent_assigned',
      target_topic_id: topicId,
      target_value:    1,
      current_value:   0,
    },
  })

  return NextResponse.json({ mission, created: true })
}

export async function DELETE(req: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parentProfile = await getCurrentProfile(supabase, user.id)
  if (!parentProfile || parentProfile.role !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const childProfileId = searchParams.get('childProfileId')
  const topicId        = searchParams.get('topicId')
  if (!childProfileId || !topicId) {
    return NextResponse.json({ error: 'childProfileId and topicId are required' }, { status: 400 })
  }

  if (!(await verifyParentChildLink(user.id, childProfileId))) {
    return NextResponse.json({ error: 'Not linked to this child' }, { status: 403 })
  }

  await prisma.childMission.deleteMany({
    where: {
      profile_id:      childProfileId,
      mission_type:    'parent_assigned',
      target_topic_id: topicId,
      completed_at:    null,
    },
  })

  return NextResponse.json({ removed: true })
}
