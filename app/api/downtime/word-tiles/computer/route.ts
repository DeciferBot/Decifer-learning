import { NextResponse } from 'next/server'
import {
  applyScrabbleTurn, parseScrabbleMove,
  type ScrabblePublicState, type ScrabbleHostPrivate, type ScrabbleGuestPrivate,
  type ScrabbleTurnResult,
} from '@/lib/downtime/scrabble-flow'
import { pickScrabbleMove, type ScrabbleDifficulty } from '@/lib/games/scrabble-ai'
import { BOARD_SIZE } from '@/lib/games/scrabble-board'
import type { ScrabbleBoard } from '@/lib/games/scrabble-engine'
import { RESULT_DIFFICULTIES, RESULT_SCORE_MAX } from '@/lib/games/results'

// POST /api/downtime/word-tiles/computer
// The referee + opponent for Word Tiles vs the computer. Stateless on
// purpose: the whole game (board, both racks, bag, scores) rides in each
// request and back out in each response, so a solo game creates no
// board_games row — matching the other vs-computer games, which keep no
// server state at all. A player editing their own solo game's JSON only
// rearranges their own practice game (computer-mode results are
// self-reported everywhere already, see /api/downtime/results).
//
// What must live here and not in the browser: the dictionary. The child's
// placement is validated by the same engine + word list as the online game,
// and the computer's reply is generated against that list — which never
// ships to the client (see lib/games/scrabble-dictionary.ts).
//
// No auth: the public /games/word-tiles page works signed out, same as the
// rest of /api/downtime.

type SoloStateBody = {
  board: ScrabbleBoard
  playerRack: string[]
  aiRack: string[]
  bag: string[]
  playerScore: number
  aiScore: number
  consecutivePasses: number
}

const TILE_SYMBOL = /^[A-Z_]$/
const LETTER = /^[A-Z]$/

function parseTiles(raw: unknown, max: number): string[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null
  const tiles: string[] = []
  for (const t of raw) {
    if (typeof t !== 'string' || !TILE_SYMBOL.test(t)) return null
    tiles.push(t)
  }
  return tiles
}

function parseBoard(raw: unknown): ScrabbleBoard | null {
  if (!Array.isArray(raw) || raw.length !== BOARD_SIZE) return null
  const board: ScrabbleBoard = []
  for (const rawRow of raw) {
    if (!Array.isArray(rawRow) || rawRow.length !== BOARD_SIZE) return null
    const row: ScrabbleBoard[number] = []
    for (const cell of rawRow) {
      if (cell === null) { row.push(null); continue }
      if (typeof cell !== 'object') return null
      const t = cell as Record<string, unknown>
      if (typeof t.letter !== 'string' || !LETTER.test(t.letter)) return null
      row.push({ letter: t.letter, isBlank: t.isBlank === true })
    }
    board.push(row)
  }
  return board
}

function parseScore(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null
  if (raw < -RESULT_SCORE_MAX || raw > RESULT_SCORE_MAX) return null
  return raw
}

function parseSoloState(raw: Record<string, unknown>): SoloStateBody | null {
  const board = parseBoard(raw.board)
  const playerRack = parseTiles(raw.playerRack, 7)
  const aiRack = parseTiles(raw.aiRack, 7)
  const bag = parseTiles(raw.bag, 100)
  const playerScore = parseScore(raw.playerScore)
  const aiScore = parseScore(raw.aiScore)
  const passes = raw.consecutivePasses
  if (!board || !playerRack || !aiRack || !bag) return null
  if (playerScore === null || aiScore === null) return null
  // 6 scoreless turns ends the game, so a live game is always at 0–5.
  if (!Number.isInteger(passes) || (passes as number) < 0 || (passes as number) > 5) return null
  return { board, playerRack, aiRack, bag, playerScore, aiScore, consecutivePasses: passes as number }
}

function winnerLabel(winner: 'host' | 'guest' | 'draw' | null): 'you' | 'computer' | 'draw' | null {
  if (winner === 'host') return 'you'
  if (winner === 'guest') return 'computer'
  return winner
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const state = parseSoloState(body)
  if (!state) return NextResponse.json({ error: 'invalid_state' }, { status: 400 })

  const move = parseScrabbleMove(body.move)
  if (!move) return NextResponse.json({ error: 'invalid_move' }, { status: 400 })

  const difficulty = body.difficulty
  if (typeof difficulty !== 'string' || !(RESULT_DIFFICULTIES as readonly string[]).includes(difficulty)) {
    return NextResponse.json({ error: 'invalid_difficulty' }, { status: 400 })
  }

  // The player sits in the host seat, the computer in the guest seat, so the
  // two-player turn logic (scoring, bag, both end-of-game rules) is reused
  // exactly as the online game runs it.
  const publicState: ScrabblePublicState = {
    board: state.board,
    bagCount: state.bag.length,
    hostScore: state.playerScore,
    guestScore: state.aiScore,
    consecutivePasses: state.consecutivePasses,
    lastMove: null,
  }
  const hostPrivate: ScrabbleHostPrivate = { rack: state.playerRack, bag: state.bag }
  const guestPrivate: ScrabbleGuestPrivate = { rack: state.aiRack }

  const playerTurn = applyScrabbleTurn(publicState, hostPrivate, guestPrivate, 'host', move)
  if (!playerTurn.ok) return NextResponse.json({ error: playerTurn.error }, { status: 422 })

  let final: ScrabbleTurnResult & { ok: true } = playerTurn
  let aiMove: ScrabblePublicState['lastMove'] = null

  if (!playerTurn.winner) {
    const reply = pickScrabbleMove(
      playerTurn.publicState.board,
      playerTurn.guestPrivate.rack,
      playerTurn.hostPrivate.bag.length,
      difficulty as ScrabbleDifficulty,
    )
    let aiTurn = applyScrabbleTurn(
      playerTurn.publicState, playerTurn.hostPrivate, playerTurn.guestPrivate, 'guest', reply,
    )
    if (!aiTurn.ok) {
      // The generator only emits engine-validated placements, so this is a
      // belt-and-braces fallback; a pass is always legal.
      aiTurn = applyScrabbleTurn(
        playerTurn.publicState, playerTurn.hostPrivate, playerTurn.guestPrivate, 'guest', { type: 'pass' },
      )
    }
    if (aiTurn.ok) {
      final = aiTurn
      aiMove = aiTurn.publicState.lastMove
    }
  }

  return NextResponse.json({
    board: final.publicState.board,
    playerRack: final.hostPrivate.rack,
    aiRack: final.guestPrivate.rack,
    bag: final.hostPrivate.bag,
    playerScore: final.publicState.hostScore,
    aiScore: final.publicState.guestScore,
    consecutivePasses: final.publicState.consecutivePasses,
    playerMove: playerTurn.publicState.lastMove,
    aiMove,
    winner: winnerLabel(final.winner),
  })
}
