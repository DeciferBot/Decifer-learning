// Turn orchestration for the word-tile game: wires lib/games/scrabble-engine.ts
// (which validates and scores ONE player's move against their own
// board/rack/bag) into the shared two-player game record — whose score goes
// up, whose turn is next, and the two end-of-game conditions (someone empties
// their rack as the bag runs out; six consecutive scoreless turns in a row).
// Mirrors the split in lib/downtime/move-engine.ts: the engine validates,
// this glues that into per-game state.
//
// The shared tile bag has nowhere else to live — board_games.state is public
// (broadcast to both players) and the bag's contents must stay hidden just
// like a rack. It's stored on the HOST's private_host_state record
// (arbitrary but consistent choice, see the migration comment) even on the
// guest's turn.

import {
  createTileBag, drawTiles, letterValue,
} from '@/lib/games/scrabble-board'
import {
  createEmptyScrabbleBoard, applyScrabbleMove,
  type ScrabbleBoard, type ScrabbleMove, type PlacementTile,
} from '@/lib/games/scrabble-engine'

export type { ScrabbleMove }

/** Parses and shape-validates a move payload straight off the network —
 *  nothing about its structure is trusted. Returns null for anything
 *  malformed; the caller turns that into a 400/422, never a crash. Mirrors
 *  the isRecord() guard in lib/downtime/move-engine.ts. */
export function parseScrabbleMove(raw: unknown): ScrabbleMove | null {
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>

  if (m.type === 'pass') return { type: 'pass' }

  if (m.type === 'exchange') {
    if (!Array.isArray(m.tiles) || m.tiles.length === 0) return null
    if (!m.tiles.every((t): t is string => typeof t === 'string' && t.length === 1)) return null
    return { type: 'exchange', tiles: m.tiles }
  }

  if (m.type === 'place') {
    if (!Array.isArray(m.tiles) || m.tiles.length === 0) return null
    const tiles: PlacementTile[] = []
    for (const raw of m.tiles) {
      if (typeof raw !== 'object' || raw === null) return null
      const t = raw as Record<string, unknown>
      if (!Number.isInteger(t.row) || !Number.isInteger(t.col)) return null
      if (typeof t.letter !== 'string' || !/^[A-Za-z]$/.test(t.letter)) return null
      tiles.push({ row: t.row as number, col: t.col as number, letter: t.letter.toUpperCase(), isBlank: t.isBlank === true })
    }
    return { type: 'place', tiles }
  }

  return null
}

export type Side = 'host' | 'guest'

export type ScrabblePublicState = {
  board: ScrabbleBoard
  bagCount: number
  hostScore: number
  guestScore: number
  consecutivePasses: number
  lastMove: { by: Side; type: 'place' | 'pass' | 'exchange'; words: string[]; points: number } | null
}

export type ScrabbleHostPrivate = { rack: string[]; bag: string[] }
export type ScrabbleGuestPrivate = { rack: string[] }

// Official rule: the game ends after six consecutive scoreless turns
// (passes/exchanges) with nobody placing a word.
const MAX_CONSECUTIVE_SCORELESS = 6

export function initialScrabbleGame(): { publicState: ScrabblePublicState; hostPrivate: ScrabbleHostPrivate } {
  const bag = createTileBag()
  const rack = drawTiles(bag, 7)
  return {
    publicState: {
      board: createEmptyScrabbleBoard(),
      bagCount: bag.length,
      hostScore: 0,
      guestScore: 0,
      consecutivePasses: 0,
      lastMove: null,
    },
    hostPrivate: { rack, bag },
  }
}

/** Called when the guest joins — deals their opening rack from the same
 *  bag the host has been holding. */
export function dealGuestRack(hostPrivate: ScrabbleHostPrivate): {
  hostPrivate: ScrabbleHostPrivate
  guestPrivate: ScrabbleGuestPrivate
} {
  const bag = [...hostPrivate.bag]
  const rack = drawTiles(bag, 7)
  return { hostPrivate: { ...hostPrivate, bag }, guestPrivate: { rack } }
}

function otherSide(side: Side): Side {
  return side === 'host' ? 'guest' : 'host'
}

function decideWinner(hostScore: number, guestScore: number): 'host' | 'guest' | 'draw' {
  if (hostScore === guestScore) return 'draw'
  return hostScore > guestScore ? 'host' : 'guest'
}

export type ScrabbleTurnResult =
  | {
      ok: true
      publicState: ScrabblePublicState
      hostPrivate: ScrabbleHostPrivate
      guestPrivate: ScrabbleGuestPrivate
      turn: Side
      winner: 'host' | 'guest' | 'draw' | null
    }
  | { ok: false; error: string }

export function applyScrabbleTurn(
  publicState: ScrabblePublicState,
  hostPrivate: ScrabbleHostPrivate,
  guestPrivate: ScrabbleGuestPrivate,
  mover: Side,
  move: ScrabbleMove,
): ScrabbleTurnResult {
  const moverRack = mover === 'host' ? hostPrivate.rack : guestPrivate.rack
  const bag = hostPrivate.bag // shared bag always lives here regardless of whose turn it is

  const result = applyScrabbleMove(publicState.board, moverRack, bag, move)
  if (!result.ok) return result

  const newHostPrivate: ScrabbleHostPrivate = mover === 'host'
    ? { rack: result.rack, bag: result.bag }
    : { rack: hostPrivate.rack, bag: result.bag }
  const newGuestPrivate: ScrabbleGuestPrivate = mover === 'guest'
    ? { rack: result.rack }
    : { rack: guestPrivate.rack }

  let hostScore = publicState.hostScore + (mover === 'host' ? result.scoreGained : 0)
  let guestScore = publicState.guestScore + (mover === 'guest' ? result.scoreGained : 0)

  let winner: 'host' | 'guest' | 'draw' | null = null

  // End condition 1: the mover just PLACED their last tiles with nothing
  // left to draw — remaining opponent tile values transfer as a scoring
  // adjustment (standard end-game rule), and the game ends immediately.
  // Gated on move.type === 'place': a pass/exchange can't legitimately
  // empty a rack, so this never fires for those (a rack that was already
  // empty before this turn would mean the game should already have ended).
  if (move.type === 'place' && result.rack.length === 0 && result.bag.length === 0) {
    const otherRack = otherSide(mover) === 'host' ? newHostPrivate.rack : newGuestPrivate.rack
    const otherRackValue = otherRack.reduce((sum, t) => sum + letterValue(t), 0)
    if (mover === 'host') { hostScore += otherRackValue; guestScore -= otherRackValue } else { guestScore += otherRackValue; hostScore -= otherRackValue }
    winner = decideWinner(hostScore, guestScore)
  }

  const consecutivePasses = result.scored ? 0 : publicState.consecutivePasses + 1
  // End condition 2: six consecutive scoreless turns — the game has
  // stalled, score whatever's on the board.
  if (!winner && consecutivePasses >= MAX_CONSECUTIVE_SCORELESS) {
    winner = decideWinner(hostScore, guestScore)
  }

  const newPublicState: ScrabblePublicState = {
    board: result.board,
    bagCount: result.bag.length,
    hostScore,
    guestScore,
    consecutivePasses,
    lastMove: { by: mover, type: move.type, words: result.wordsFormed, points: result.scoreGained },
  }

  return {
    ok: true,
    publicState: newPublicState,
    hostPrivate: newHostPrivate,
    guestPrivate: newGuestPrivate,
    turn: winner ? mover : otherSide(mover),
    winner,
  }
}
