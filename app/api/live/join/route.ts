import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  getAuthedProfile,
  getGuestToken,
  cleanNickname,
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
} from '@/lib/live/server'
import { broadcastLiveSnapshot } from '@/lib/live/broadcast'

const MAX_PLAYERS = 50 // Supabase Realtime pool is ~100 connections; 50 per game gives headroom for 2 concurrent games

// POST /api/live/join  { pin, nickname? }
// Join a lobby by its 6-digit PIN. Works two ways:
//   • logged-in player → joined as their profile (nickname ignored)
//   • guest (no account) → joined with a nickname; a cookie token identifies
//     them across requests (Kahoot style).
// Idempotent: re-joining a game you're already in just returns it.
export async function POST(req: Request) {
  let body: { pin?: string; nickname?: string }
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
    select: {
      id: true, status: true,
      _count: { select: { players: true } },
    },
  })
  if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 })

  const profile = await getAuthedProfile()

  // ---- Logged-in player ----
  if (profile) {
    const existing = await prisma.liveGamePlayer.findUnique({
      where: { game_id_profile_id: { game_id: game.id, profile_id: profile.id } },
      select: { id: true },
    })
    if (!existing) {
      if (game.status !== 'lobby') {
        return NextResponse.json({ error: 'game_already_started' }, { status: 409 })
      }
      if (game._count.players >= MAX_PLAYERS) {
        return NextResponse.json({ error: 'game_full', max: MAX_PLAYERS }, { status: 409 })
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
      await broadcastLiveSnapshot(game.id) // update everyone's lobby roster
    }
    return NextResponse.json({ gameId: game.id })
  }

  // ---- Guest player ----
  let token = getGuestToken()
  if (token) {
    const existing = await prisma.liveGamePlayer.findUnique({
      where: { game_id_guest_token: { game_id: game.id, guest_token: token } },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ gameId: game.id })
  }

  const nickname = cleanNickname(body.nickname)
  if (!nickname) return NextResponse.json({ error: 'need_nickname' }, { status: 400 })
  if (game.status !== 'lobby') {
    return NextResponse.json({ error: 'game_already_started' }, { status: 409 })
  }
  if (game._count.players >= MAX_PLAYERS) {
    return NextResponse.json({ error: 'game_full', max: MAX_PLAYERS }, { status: 409 })
  }

  if (!token) token = randomUUID()
  await prisma.liveGamePlayer.create({
    data: {
      game_id: game.id,
      guest_token: token,
      is_guest: true,
      display_name: nickname,
      is_host: false,
    },
  })
  await broadcastLiveSnapshot(game.id) // update everyone's lobby roster

  const res = NextResponse.json({ gameId: game.id })
  res.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  })
  return res
}
