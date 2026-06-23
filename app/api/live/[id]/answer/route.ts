import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthedProfile } from '@/lib/live/server'
import { normalizeAnswer } from '@/lib/live/questions'
import { computeLivePoints } from '@/lib/live/scoring'

// POST /api/live/[id]/answer  { index, answer }
// Server-authoritative scoring. Correctness is decided here against the stored,
// code-verified correct_answer (never the client, never an LLM — CLAUDE.md §4).
// Timing is measured from the server's current_started_at, so a player can't
// fake a fast buzz. One answer per player per question (DB-enforced).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { index?: number; answer?: string; timedOut?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  // A `timedOut` submission records a non-answer (0 points) and exists so the
  // client can reveal the correct answer to a player who ran out of time.
  const timedOut = body.timedOut === true
  const answer = typeof body.answer === 'string' ? body.answer : ''
  if (!answer && !timedOut) return NextResponse.json({ error: 'No answer' }, { status: 400 })

  const game = await prisma.liveGame.findUnique({
    where: { id: params.id },
    select: {
      status: true,
      current_index: true,
      current_started_at: true,
      seconds_per_question: true,
      question_ids: true,
    },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (game.status !== 'in_progress') {
    return NextResponse.json({ error: 'Game is not running' }, { status: 409 })
  }

  const index = game.current_index
  if (Number.isFinite(body.index) && body.index !== index) {
    return NextResponse.json({ error: 'stale_index', currentIndex: index }, { status: 409 })
  }

  const player = await prisma.liveGamePlayer.findUnique({
    where: { game_id_profile_id: { game_id: params.id, profile_id: profile.id } },
    select: { id: true, score: true, streak: true },
  })
  if (!player) return NextResponse.json({ error: 'Not a player' }, { status: 403 })

  const ids = game.question_ids as string[]
  const questionId = ids[index]
  const q = await prisma.quizQuestion.findFirst({
    where: { id: questionId, status: 'published' },
    select: { correct_answer: true },
  })
  if (!q) return NextResponse.json({ error: 'Question unavailable' }, { status: 404 })

  // Server-measured response time, clamped to the question window.
  const startedAtMs = game.current_started_at ? game.current_started_at.getTime() : Date.now()
  const limitMs = game.seconds_per_question * 1000
  const rawMs = Date.now() - startedAtMs
  const msTaken = Math.min(limitMs, Math.max(0, rawMs))

  const correct = !timedOut && normalizeAnswer(answer) === normalizeAnswer(q.correct_answer)
  const points = computeLivePoints({
    correct,
    msTaken,
    limitMs,
    streakBefore: player.streak,
  })

  try {
    await prisma.$transaction([
      prisma.liveGameAnswer.create({
        data: {
          game_id: params.id,
          player_id: player.id,
          question_index: index,
          question_id: questionId,
          answer: answer || '(no answer)',
          was_correct: correct,
          ms_taken: msTaken,
          points_awarded: points,
        },
      }),
      prisma.liveGamePlayer.update({
        where: { id: player.id },
        data: {
          score: { increment: points },
          streak: correct ? { increment: 1 } : { set: 0 },
          last_seen: new Date(),
        },
      }),
    ])
  } catch (e) {
    // Unique (player_id, question_index) violation → already answered.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'already_answered' }, { status: 409 })
    }
    throw e
  }

  // Reveal correctness only after the player is locked in.
  return NextResponse.json({ correct, points, correctAnswer: q.correct_answer })
}
