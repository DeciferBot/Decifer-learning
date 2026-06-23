import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolvePlayer } from '@/lib/live/server'

// GET /api/live/[id]/tally
// Live answer stats for the current question: how many players have answered,
// and the per-answer distribution (for the host's reveal bar chart). The
// correct answer is included ONLY for the host, so players can't peek by polling.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await resolvePlayer(params.id)
  if (!me) return NextResponse.json({ error: 'Not a player' }, { status: 403 })

  const game = await prisma.liveGame.findUnique({
    where: { id: params.id },
    select: { status: true, current_index: true, question_ids: true },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const index = game.current_index
  const [total, answers] = await Promise.all([
    prisma.liveGamePlayer.count({ where: { game_id: params.id } }),
    prisma.liveGameAnswer.findMany({
      where: { game_id: params.id, question_index: index },
      select: { answer: true },
    }),
  ])

  const distribution: Record<string, number> = {}
  for (const a of answers) {
    if (a.answer === '(no answer)') continue
    distribution[a.answer] = (distribution[a.answer] ?? 0) + 1
  }

  let correctAnswer: string | null = null
  if (me.is_host) {
    const ids = game.question_ids as string[]
    const q = await prisma.quizQuestion.findFirst({
      where: { id: ids[index], status: 'published' },
      select: { correct_answer: true },
    })
    correctAnswer = q?.correct_answer ?? null
  }

  return NextResponse.json({ index, total, answered: answers.length, distribution, correctAnswer })
}
