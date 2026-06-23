import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveHostAuth } from '@/lib/live/server'
import { liveDeciferPoints } from '@/lib/live/scoring'

// POST /api/live/[id]/next — host advances to the next question, or ends the
// game after the last one. Works for profile hosts and guest hosts alike.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const isHost = await resolveHostAuth(params.id)
  if (!isHost) return NextResponse.json({ error: 'Only the host can advance' }, { status: 403 })

  const game = await prisma.liveGame.findUnique({
    where: { id: params.id },
    select: { status: true, current_index: true, question_count: true },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (game.status !== 'in_progress') return NextResponse.json({ error: 'Game is not running' }, { status: 409 })

  const nextIndex = game.current_index + 1

  if (nextIndex < game.question_count) {
    await prisma.liveGame.update({
      where: { id: params.id },
      data: { current_index: nextIndex, current_started_at: new Date() },
    })
    return NextResponse.json({ ok: true, finished: false, index: nextIndex })
  }

  // ---- Finish the game and award real Decifer points (once). ----
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.liveGame.findUnique({
      where: { id: params.id },
      select: { status: true },
    })
    if (!fresh || fresh.status !== 'in_progress') return

    const players = await tx.liveGamePlayer.findMany({
      where: { game_id: params.id },
      orderBy: { score: 'desc' },
      select: { id: true, profile_id: true },
    })

    const correctByPlayer = new Map<string, number>()
    const counts = await tx.liveGameAnswer.groupBy({
      by: ['player_id'],
      where: { game_id: params.id, was_correct: true },
      _count: { _all: true },
    })
    for (const c of counts) correctByPlayer.set(c.player_id, c._count._all)

    for (let rank = 0; rank < players.length; rank++) {
      const p = players[rank]
      if (!p.profile_id) continue // guest — no account to credit
      const correctCount = correctByPlayer.get(p.id) ?? 0
      const award = liveDeciferPoints(correctCount, rank)
      if (award <= 0) continue
      await tx.pointEvent.create({
        data: { profile_id: p.profile_id, amount: award, reason: 'live_game' },
      })
      await tx.profile.update({
        where: { id: p.profile_id },
        data: { total_points: { increment: award } },
      })
    }

    await tx.liveGame.update({
      where: { id: params.id },
      data: { status: 'finished', current_index: game.question_count, finished_at: new Date() },
    })
  })

  return NextResponse.json({ ok: true, finished: true })
}
