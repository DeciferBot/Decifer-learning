import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveSide } from '@/lib/downtime/server'
import { applyBoardMove, type GameType, type Side } from '@/lib/downtime/move-engine'
import { broadcastBoardGame, type BoardGameSnapshot } from '@/lib/downtime/broadcast'
import {
  applyScrabbleTurn, parseScrabbleMove,
  type ScrabblePublicState, type ScrabbleHostPrivate, type ScrabbleGuestPrivate,
} from '@/lib/downtime/scrabble-flow'

// POST /api/downtime/games/[id]/move  { move }
// The only write path for gameplay. `move` is game-type-specific (see
// lib/downtime/move-engine.ts for Chess/Checkers/Connect 4, and
// lib/downtime/scrabble-flow.ts for the word-tile game) and is fully
// re-validated server-side — nothing about legality or the resulting board
// is ever trusted from the client. Broadcasts the new PUBLIC state to both
// players on success; the word-tile branch additionally returns the
// mover's own updated rack directly in the response (never broadcast,
// never visible to the opponent).

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: { move?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const game = await prisma.boardGame.findUnique({
    where: { id: params.id },
    select: {
      id: true, game_type: true, status: true, state: true, turn: true,
      private_host_state: true, private_guest_state: true,
      host_profile_id: true, host_guest_token: true,
      guest_profile_id: true, guest_guest_token: true,
    },
  })
  if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 })
  if (game.status !== 'active') return NextResponse.json({ error: 'game_not_active' }, { status: 409 })

  const side = await resolveSide(game)
  if (!side) return NextResponse.json({ error: 'not_a_player' }, { status: 403 })

  if (game.game_type === 'scrabble') {
    const move = parseScrabbleMove(body.move)
    if (!move) return NextResponse.json({ error: 'invalid_move' }, { status: 400 })

    const turnResult = applyScrabbleTurn(
      game.state as unknown as ScrabblePublicState,
      game.private_host_state as unknown as ScrabbleHostPrivate,
      game.private_guest_state as unknown as ScrabbleGuestPrivate,
      side,
      move,
    )
    if (!turnResult.ok) return NextResponse.json({ error: turnResult.error }, { status: 422 })

    const updated = await prisma.boardGame.update({
      where: { id: game.id },
      data: {
        state: turnResult.publicState as unknown as Prisma.InputJsonValue,
        private_host_state: turnResult.hostPrivate as unknown as Prisma.InputJsonValue,
        private_guest_state: turnResult.guestPrivate as unknown as Prisma.InputJsonValue,
        turn: turnResult.turn,
        status: turnResult.winner ? 'finished' : 'active',
        winner: turnResult.winner,
        finished_at: turnResult.winner ? new Date() : undefined,
      },
      select: {
        id: true, game_type: true, status: true, state: true, turn: true, winner: true,
        host_display_name: true, guest_display_name: true, updated_at: true,
      },
    })

    const snapshot: BoardGameSnapshot = { ...updated, updated_at: updated.updated_at.toISOString() }
    await broadcastBoardGame(game.id, snapshot)

    const moverRack = side === 'host' ? turnResult.hostPrivate.rack : turnResult.guestPrivate.rack
    return NextResponse.json({ game: snapshot, rack: moverRack })
  }

  const result = applyBoardMove(
    game.game_type as GameType,
    game.state,
    game.turn as Side,
    side,
    body.move,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })

  const updated = await prisma.boardGame.update({
    where: { id: game.id },
    data: {
      state: result.state as Prisma.InputJsonValue,
      turn: result.turn,
      status: result.winner ? 'finished' : 'active',
      winner: result.winner,
      finished_at: result.winner ? new Date() : undefined,
    },
    select: {
      id: true, game_type: true, status: true, state: true, turn: true, winner: true,
      host_display_name: true, guest_display_name: true, updated_at: true,
    },
  })

  const snapshot: BoardGameSnapshot = { ...updated, updated_at: updated.updated_at.toISOString() }
  await broadcastBoardGame(game.id, snapshot)

  return NextResponse.json({ game: snapshot })
}
