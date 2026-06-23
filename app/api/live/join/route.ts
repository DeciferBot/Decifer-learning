import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthedProfile } from '@/lib/live/server'

// POST /api/live/join — join a lobby by its 6-digit PIN. Idempotent: re-joining
// a game you're already in just returns it. Returns { gameId }.

export async function POST(req: Request) {
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { pin?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const pin = (body.pin ?? '').trim()
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'Enter a 6-digit code' }, { status: 400 })
  }

  const game = await prisma.liveGame.findFirst({
    where: { pin, status: { not: 'finished' } },
    select: { id: true, status: true },
  })
  if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 })

  const existing = await prisma.liveGamePlayer.findUnique({
    where: { game_id_profile_id: { game_id: game.id, profile_id: profile.id } },
    select: { id: true },
  })

  if (!existing) {
    // Only allow new players to join while still in the lobby.
    if (game.status !== 'lobby') {
      return NextResponse.json({ error: 'game_already_started' }, { status: 409 })
    }
    await prisma.liveGamePlayer.create({
      data: {
        game_id: game.id,
        profile_id: profile.id,
        display_name: profile.display_name,
        avatar_config: profile.avatar_config ?? undefined,
        is_host: false,
      },
    })
  }

  return NextResponse.json({ gameId: game.id })
}
