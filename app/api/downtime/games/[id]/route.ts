import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveSide } from '@/lib/downtime/server'
import { boardGameSnapshot } from '@/lib/downtime/broadcast'

// GET /api/downtime/games/[id]
// Returns the caller's side in the game (host/guest/null for a stranger)
// plus the current public snapshot — used for first paint before the
// Realtime subscription takes over. The invite code is included only for
// the host (so a page refresh during the waiting room still shows it to
// share) — a guest already used it to join and a stranger has no business
// seeing it.

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const game = await prisma.boardGame.findUnique({
    where: { id: params.id },
    select: {
      invite_code: true,
      host_profile_id: true, host_guest_token: true,
      guest_profile_id: true, guest_guest_token: true,
    },
  })
  if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 })

  const side = await resolveSide(game)
  const snapshot = await boardGameSnapshot(params.id)
  return NextResponse.json({
    side,
    game: snapshot,
    inviteCode: side === 'host' ? game.invite_code : null,
  })
}
