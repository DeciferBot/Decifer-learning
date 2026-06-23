import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthedProfile, generateUniquePin } from '@/lib/live/server'
import { selectLiveQuestions } from '@/lib/live/questions'

// POST /api/live/create
// Host creates a Decifer Live game. Picks a published, tap-tile question pool
// for the chosen scope (single topic or mixed subject), allocates a PIN, and
// auto-joins the host as the first player. Returns { gameId, pin }.

type CreateBody = {
  mode: 'topic' | 'subject'
  topicId?: string
  subjectId?: string
  yearGroupId?: string
  questionCount?: number
  secondsPerQuestion?: number
}

const MIN_QUESTIONS = 3
const MAX_QUESTIONS = 20
const ALLOWED_SECONDS = new Set([10, 15, 20, 30])

export async function POST(req: Request) {
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const mode = body.mode === 'subject' ? 'subject' : 'topic'
  const questionCount = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, body.questionCount ?? 10))
  const secondsPerQuestion = ALLOWED_SECONDS.has(body.secondsPerQuestion ?? 0)
    ? (body.secondsPerQuestion as number)
    : 20

  if (mode === 'topic' && !body.topicId) {
    return NextResponse.json({ error: 'topicId required' }, { status: 400 })
  }
  if (mode === 'subject' && !body.subjectId) {
    return NextResponse.json({ error: 'subjectId required' }, { status: 400 })
  }

  // Default the scope's year group to the host's own when not given.
  const yearGroupId = body.yearGroupId ?? profile.year_group_id ?? null

  const questions = await selectLiveQuestions({
    mode,
    topicId: body.topicId,
    subjectId: body.subjectId,
    yearGroupId,
    count: questionCount,
  })

  if (questions.length < MIN_QUESTIONS) {
    return NextResponse.json(
      { error: 'not_enough_questions', available: questions.length },
      { status: 422 },
    )
  }

  const pin = await generateUniquePin()

  const game = await prisma.liveGame.create({
    data: {
      pin,
      host_profile_id: profile.id,
      status: 'lobby',
      mode,
      topic_id: mode === 'topic' ? body.topicId : null,
      subject_id: mode === 'subject' ? body.subjectId : null,
      year_group_id: yearGroupId,
      question_ids: questions.map((q) => q.id),
      question_count: questions.length,
      seconds_per_question: secondsPerQuestion,
      current_index: -1,
      players: {
        create: {
          profile_id: profile.id,
          display_name: profile.display_name,
          avatar_config: profile.avatar_config ?? undefined,
          is_host: true,
        },
      },
    },
    select: { id: true, pin: true },
  })

  return NextResponse.json({ gameId: game.id, pin: game.pin })
}
