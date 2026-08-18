import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getAuthedProfile, getGuestToken, cleanNickname,
  GUEST_COOKIE, GUEST_COOKIE_MAX_AGE,
} from '@/lib/downtime/server'
import { broadcastBoardGameSnapshot } from '@/lib/downtime/broadcast'

// POST /api/downtime/games/join  { inviteCode, nickname? }
// Joins a waiting game by its 6-character invite code. Idempotent: the host
// (or an already-joined guest) re-posting their own code just returns the
// game id rather than erroring.

type JoinBody = { inviteCode?: string; nickname?: string }

export async function POST(req: Request) {
  let body: JoinBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const code = (body.inviteCode ?? '').trim().toUpperCase()
  if (!/^[A-Z2-9]{6}$/.test(code)) {
    return NextResponse.json({ error: 'Enter a 6-character code' }, { status: 400 })
  }

  const game = await prisma.boardGame.findFirst({
    where: { invite_code: code, status: { not: 'finished' } },
    select: {
      id: true, status: true,
      host_profile_id: true, host_guest_token: true,
      guest_profile_id: true, guest_guest_token: true,
    },
  })
  if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 })

  const profile = await getAuthedProfile()
  const existingGuestToken = getGuestToken()

  const isHost = (profile && game.host_profile_id === profile.id)
    || (!!existingGuestToken && game.host_guest_token === existingGuestToken)
  if (isHost) return NextResponse.json({ gameId: game.id })

  const isJoinedGuest = (profile && game.guest_profile_id === profile.id)
    || (!!existingGuestToken && game.guest_guest_token === existingGuestToken)
  if (isJoinedGuest) return NextResponse.json({ gameId: game.id })

  if (game.status !== 'waiting') {
    return NextResponse.json({ error: 'game_already_started' }, { status: 409 })
  }

  let guestProfileId: string | null = null
  let guestGuestToken: string | null = null
  let guestDisplayName: string

  if (profile) {
    guestProfileId = profile.id
    guestDisplayName = profile.display_name
  } else {
    const nickname = cleanNickname(body.nickname)
    if (!nickname) {
      const typedSomething = typeof body.nickname === 'string' && body.nickname.trim().length > 0
      return NextResponse.json(
        { error: typedSomething ? 'nickname_not_allowed' : 'need_nickname' },
        { status: 400 },
      )
    }
    guestGuestToken = crypto.randomUUID()
    guestDisplayName = nickname
  }

  await prisma.boardGame.update({
    where: { id: game.id },
    data: {
      guest_profile_id: guestProfileId,
      guest_guest_token: guestGuestToken,
      guest_display_name: guestDisplayName,
      status: 'active',
    },
  })
  await broadcastBoardGameSnapshot(game.id)

  const res = NextResponse.json({ gameId: game.id })
  if (guestGuestToken) {
    res.cookies.set(GUEST_COOKIE, guestGuestToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: GUEST_COOKIE_MAX_AGE,
    })
  }
  return res
}
