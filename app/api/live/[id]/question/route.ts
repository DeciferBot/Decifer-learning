import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthedProfile } from '@/lib/live/server'
import { buildChoices, choiceSeed } from '@/lib/live/questions'

// GET /api/live/[id]/question?index=K
// Returns the render payload for the current question: the prompt and shuffled
// answer tiles — but NOT which one is correct, so the client can't peek. Only
// players in the game may fetch it, and only while the game is running.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const game = await prisma.liveGame.findUnique({
    where: { id: params.id },
    select: {
      status: true,
      current_index: true,
      current_started_at: true,
      question_count: true,
      seconds_per_question: true,
      question_ids: true,
    },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Membership check — only joined players can read the questions.
  const player = await prisma.liveGamePlayer.findUnique({
    where: { game_id_profile_id: { game_id: params.id, profile_id: profile.id } },
    select: { id: true },
  })
  if (!player) return NextResponse.json({ error: 'Not a player' }, { status: 403 })

  if (game.status !== 'in_progress') {
    return NextResponse.json({ error: 'not_in_progress', status: game.status }, { status: 409 })
  }

  const index = game.current_index
  const url = new URL(req.url)
  const requested = Number(url.searchParams.get('index'))
  // The client tells us which index it's rendering; reject stale requests so a
  // lagging device never shows the wrong question.
  if (Number.isFinite(requested) && requested !== index) {
    return NextResponse.json({ error: 'stale_index', currentIndex: index }, { status: 409 })
  }

  const ids = game.question_ids as string[]
  const questionId = ids[index]
  if (!questionId) return NextResponse.json({ error: 'No question' }, { status: 404 })

  const q = await prisma.quizQuestion.findFirst({
    where: { id: questionId, status: 'published' },
    select: { tier: true, question_text: true, correct_answer: true, distractors: true },
  })
  if (!q) return NextResponse.json({ error: 'Question unavailable' }, { status: 404 })

  const choices = buildChoices(
    q.correct_answer,
    (q.distractors as string[]) ?? [],
    choiceSeed(params.id, index),
  )

  const startedAtMs = game.current_started_at ? game.current_started_at.getTime() : Date.now()
  const endsAt = startedAtMs + game.seconds_per_question * 1000

  return NextResponse.json({
    index,
    total: game.question_count,
    tier: String(q.tier),
    questionText: q.question_text,
    choices,
    secondsPerQuestion: game.seconds_per_question,
    startedAt: startedAtMs,
    endsAt,
  })
}
