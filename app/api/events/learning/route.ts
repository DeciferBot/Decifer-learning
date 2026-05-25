import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { recordLearningEvent, isValidEventType, type LearningEventType } from '@/lib/learning-events'

type EventBody = {
  eventType: string
  subjectId?: string | null
  topicId?: string | null
  lessonId?: string | null
  quizAttemptId?: string | null
  metadata?: Record<string, unknown>
}

export async function POST(req: Request) {
  // Auth: only allow authenticated users to record events against their own profile
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: EventBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.eventType || !isValidEventType(body.eventType)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
  }

  // Resolve caller's profile — this is the ownership check
  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Sanitise metadata — strip any attempt to embed profile_id overrides
  const { eventType, subjectId, topicId, lessonId, quizAttemptId, metadata } = body
  const safeMetadata: Record<string, unknown> = {}
  if (metadata && typeof metadata === 'object') {
    for (const [k, v] of Object.entries(metadata)) {
      if (k === 'profile_id') continue // never allow override
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        safeMetadata[k] = v
      }
    }
  }

  await recordLearningEvent({
    profileId:      profile.id,
    eventType:      eventType as LearningEventType,
    subjectId:      subjectId ?? null,
    topicId:        topicId ?? null,
    lessonId:       lessonId ?? null,
    quizAttemptId:  quizAttemptId ?? null,
    metadata:       safeMetadata,
  })

  return NextResponse.json({ ok: true })
}
