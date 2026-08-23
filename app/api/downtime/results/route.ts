import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthedProfile } from '@/lib/downtime/server'
import { GAME_CATALOGUE } from '@/lib/games/catalogue'
import {
  RESULT_MODES, RESULT_OUTCOMES, RESULT_DIFFICULTIES, RESULT_SCORE_MAX,
} from '@/lib/games/results'

// POST /api/downtime/results  { gameType, mode, outcome, difficulty?, score? }
// Records a finished Downtime game against the logged-in caller's profile.
// A signed-out caller gets { saved: false } rather than an error — that is a
// normal outcome (the public /games pages need no login), and it is the
// signal the game-over card uses to show its "register to keep your history"
// invitation. Nothing here is trusted for points or rewards; it is a private
// history list, so a fabricated POST can only pad the caller's own list.

type Body = {
  gameType?: unknown
  mode?: unknown
  outcome?: unknown
  difficulty?: unknown
  score?: unknown
}

const VALID_GAME_TYPES = GAME_CATALOGUE.map((g) => g.id as string)

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { gameType, mode, outcome, difficulty, score } = body
  if (typeof gameType !== 'string' || !VALID_GAME_TYPES.includes(gameType)) {
    return NextResponse.json({ error: 'invalid_game_type' }, { status: 400 })
  }
  if (typeof mode !== 'string' || !(RESULT_MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 })
  }
  if (typeof outcome !== 'string' || !(RESULT_OUTCOMES as readonly string[]).includes(outcome)) {
    return NextResponse.json({ error: 'invalid_outcome' }, { status: 400 })
  }
  if (
    difficulty !== undefined && difficulty !== null
    && (typeof difficulty !== 'string' || !(RESULT_DIFFICULTIES as readonly string[]).includes(difficulty))
  ) {
    return NextResponse.json({ error: 'invalid_difficulty' }, { status: 400 })
  }
  if (
    score !== undefined && score !== null
    && (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > RESULT_SCORE_MAX)
  ) {
    return NextResponse.json({ error: 'invalid_score' }, { status: 400 })
  }

  const profile = await getAuthedProfile()
  if (!profile) {
    return NextResponse.json({ saved: false })
  }

  await prisma.downtimeResult.create({
    data: {
      profile_id: profile.id,
      game_type: gameType,
      mode,
      outcome,
      difficulty: (difficulty as string | undefined) ?? null,
      score: (score as number | undefined) ?? null,
    },
  })

  return NextResponse.json({ saved: true })
}
