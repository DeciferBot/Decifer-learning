import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getAuthedProfile, generateUniqueInviteCode, cleanNickname,
  GUEST_COOKIE, GUEST_COOKIE_MAX_AGE,
} from '@/lib/downtime/server'
import { initialBoardState, type GameType } from '@/lib/downtime/move-engine'
import { initialScrabbleGame } from '@/lib/downtime/scrabble-flow'

// POST /api/downtime/games  { gameType, nickname? }
// Creates a waiting game and returns its invite code. The caller becomes the
// host — logged-in users host as their profile; guests supply a nickname
// (same guest-cookie identity pattern as Decifer Live).

type AnyGameType = GameType | 'scrabble'
const VALID_TYPES: AnyGameType[] = ['chess', 'checkers', 'connect4', 'scrabble']

type CreateBody = { gameType?: string; nickname?: string }

export async function POST(req: Request) {
  const profile = await getAuthedProfile()

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!VALID_TYPES.includes(body.gameType as AnyGameType)) {
    return NextResponse.json({ error: 'invalid_game_type' }, { status: 400 })
  }
  const gameType = body.gameType as AnyGameType

  let hostProfileId: string | null = null
  let hostGuestToken: string | null = null
  let hostDisplayName: string

  if (profile) {
    hostProfileId = profile.id
    hostDisplayName = profile.display_name
  } else {
    const nickname = cleanNickname(body.nickname)
    if (!nickname) {
      const typedSomething = typeof body.nickname === 'string' && body.nickname.trim().length > 0
      return NextResponse.json(
        { error: typedSomething ? 'nickname_not_allowed' : 'need_nickname' },
        { status: 400 },
      )
    }
    hostGuestToken = crypto.randomUUID()
    hostDisplayName = nickname
  }

  const inviteCode = await generateUniqueInviteCode()

  let state: unknown
  let hostPrivateState: unknown
  if (gameType === 'scrabble') {
    const initial = initialScrabbleGame()
    state = initial.publicState
    hostPrivateState = initial.hostPrivate
  } else {
    state = initialBoardState(gameType)
  }

  const game = await prisma.boardGame.create({
    data: {
      game_type: gameType,
      invite_code: inviteCode,
      status: 'waiting',
      state: state as Prisma.InputJsonValue,
      private_host_state: hostPrivateState as Prisma.InputJsonValue | undefined,
      turn: 'host',
      host_profile_id: hostProfileId,
      host_guest_token: hostGuestToken,
      host_display_name: hostDisplayName,
    },
    select: { id: true, invite_code: true },
  })

  if (hostGuestToken) {
    cookies().set(GUEST_COOKIE, hostGuestToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: GUEST_COOKIE_MAX_AGE,
      path: '/',
    })
  }

  return NextResponse.json({ gameId: game.id, inviteCode: game.invite_code })
}
