import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// POST /api/quiz/reflection
// Saves a child's OIT reflection ("What did you figure out today?")
// after a passing quiz. Short text, max 500 chars. No moderation queue —
// content is child-authored, private to child + linked parent.

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topicId: string; text: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topicId, text } = body
  if (!topicId || !text?.trim()) {
    return NextResponse.json({ error: 'topicId and text are required' }, { status: 400 })
  }

  const trimmed = text.trim().slice(0, 500)

  const profile = await prisma.profile.findUnique({ where: { user_id: user.id } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  await prisma.quizReflection.create({
    data: {
      profile_id: profile.id,
      topic_id: topicId,
      text: trimmed,
    },
  })

  return NextResponse.json({ ok: true })
}
