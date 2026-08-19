// Server-authoritative move validation for Downtime board games. The API
// route (app/api/downtime/games/[id]/move) is the only caller — it never
// trusts a client-reported resulting board, only a proposed move, which is
// re-validated and re-applied here against the engine's own rules
// (chess.js for chess; the hand-written + unit-tested modules for
// checkers/connect4). This mirrors how quiz answers are graded server-side
// against quiz_questions.correct_answer rather than trusting the client.
//
// The host always plays the side that moves first: White in chess, Red in
// checkers and Connect 4. The guest plays the other side.

import { Chess } from 'chess.js'
import {
  createInitialBoard as createCheckersBoard, findLegalMove as findCheckersLegalMove,
  applyMove as applyCheckersMove, determineOutcome as checkersOutcome,
  type Board as CheckersBoard, type CheckersColor,
} from '@/lib/games/checkers-ai'
import {
  createEmptyBoard as createConnect4Board, dropPiece, legalColumns, winnerAt, isBoardFull,
  type Board as Connect4Board,
} from '@/lib/games/connect4-ai'

export type GameType = 'chess' | 'checkers' | 'connect4'
export type Side = 'host' | 'guest'
export type Outcome = Side | 'draw' | null

export type MoveResult =
  | { ok: true; state: unknown; turn: Side; winner: Outcome }
  | { ok: false; error: string }

// `move` arrives from network JSON, so it can be anything — including null,
// a string, or an array — despite whatever shape a `move as {...}` cast
// claims. Every apply*Move function checks this before touching properties.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function initialBoardState(gameType: GameType): unknown {
  switch (gameType) {
    case 'chess': return { fen: new Chess().fen() }
    case 'checkers': return { board: createCheckersBoard() }
    case 'connect4': return { board: createConnect4Board() }
  }
}

function otherSide(side: Side): Side {
  return side === 'host' ? 'guest' : 'host'
}

function applyChessMove(state: unknown, mover: Side, move: unknown): MoveResult {
  const s = state as { fen: string }
  const game = new Chess(s.fen)
  const color = mover === 'host' ? 'w' : 'b'
  if (game.turn() !== color) return { ok: false, error: 'not_your_turn' }

  if (!isRecord(move)) return { ok: false, error: 'invalid_move' }
  const m = move as { from?: unknown; to?: unknown; promotion?: unknown }
  if (typeof m.from !== 'string' || typeof m.to !== 'string') return { ok: false, error: 'invalid_move' }

  let applied
  try {
    applied = game.move({
      from: m.from,
      to: m.to,
      promotion: typeof m.promotion === 'string' ? m.promotion : 'q',
    })
  } catch {
    applied = null
  }
  if (!applied) return { ok: false, error: 'illegal_move' }

  let winner: Outcome = null
  if (game.isCheckmate()) winner = mover
  else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) winner = 'draw'

  return { ok: true, state: { fen: game.fen() }, turn: otherSide(mover), winner }
}

function applyCheckersMoveFor(state: unknown, mover: Side, move: unknown): MoveResult {
  const s = state as { board: CheckersBoard }
  const color: CheckersColor = mover === 'host' ? 'red' : 'black'
  if (!isRecord(move)) return { ok: false, error: 'invalid_move' }
  const m = move as { from?: unknown; to?: unknown }
  if (
    !Array.isArray(m.from) || m.from.length !== 2 || typeof m.from[0] !== 'number' || typeof m.from[1] !== 'number'
    || !Array.isArray(m.to) || m.to.length !== 2 || typeof m.to[0] !== 'number' || typeof m.to[1] !== 'number'
  ) {
    return { ok: false, error: 'invalid_move' }
  }

  const found = findCheckersLegalMove(
    s.board, color,
    [m.from[0], m.from[1]],
    [m.to[0], m.to[1]],
  )
  if (!found) return { ok: false, error: 'illegal_move' }

  const nextBoard = applyCheckersMove(s.board, found, color)
  const outcome = checkersOutcome(nextBoard, color) // always `color`/mover if truthy — see checkers-ai.ts
  const winner: Outcome = outcome ? mover : null

  return { ok: true, state: { board: nextBoard }, turn: otherSide(mover), winner }
}

function applyConnect4Move(state: unknown, mover: Side, move: unknown): MoveResult {
  const s = state as { board: Connect4Board }
  const color = mover === 'host' ? 'red' : 'yellow'
  if (!isRecord(move)) return { ok: false, error: 'invalid_move' }
  const m = move as { col?: unknown }
  if (typeof m.col !== 'number' || !Number.isInteger(m.col)) return { ok: false, error: 'invalid_move' }
  if (!legalColumns(s.board).includes(m.col)) return { ok: false, error: 'illegal_move' }

  const result = dropPiece(s.board, m.col, color)
  if (!result) return { ok: false, error: 'illegal_move' }

  let winner: Outcome = null
  if (winnerAt(result.board, result.row, m.col)) winner = mover
  else if (isBoardFull(result.board)) winner = 'draw'

  return { ok: true, state: { board: result.board }, turn: otherSide(mover), winner }
}

/** Validates and applies `move` for `mover`, who must be `turn`. Returns the
 *  new public state, whose turn is next, and the outcome (null = still
 *  playing) — or `{ ok: false }` with a reason if the move is illegal or
 *  out of turn. Never trusts anything from `move` beyond what each engine's
 *  own rule-checker (chess.js / findLegalMove / legalColumns+dropPiece)
 *  independently verifies. */
export function applyBoardMove(gameType: GameType, state: unknown, turn: Side, mover: Side, move: unknown): MoveResult {
  if (mover !== turn) return { ok: false, error: 'not_your_turn' }
  switch (gameType) {
    case 'chess': return applyChessMove(state, mover, move)
    case 'checkers': return applyCheckersMoveFor(state, mover, move)
    case 'connect4': return applyConnect4Move(state, mover, move)
  }
}
