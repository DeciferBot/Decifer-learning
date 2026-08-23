import { Chess } from 'chess.js'

/**
 * Works out which pieces moved between two positions, so the board can
 * animate them sliding from where they were to where they are — including
 * the ones a plain from/to pair misses: castling moves the rook as well as
 * the king, and en passant removes a pawn from a square nobody landed on.
 *
 * Diffing FENs rather than threading move objects through means the same
 * animation works in computer mode AND online mode, where the server sends
 * back only the resulting position. It also degrades gracefully when a
 * Realtime update skips a ply: each arrival is matched to a vacated square
 * of the same piece, so both sides' pieces still slide home.
 *
 * Lives here rather than in the component so the fiddly cases (castling,
 * en passant, promotion, a reset mid-game) can be unit-tested in node.
 */

export type MoveDiff = {
  /** destination square -> the square that piece came from */
  origins: Map<string, string>
  /** squares a moving piece left — their old occupant should vanish
   *  instantly (the slide IS the animation), not fade like a capture */
  moved: Set<string>
  /** true when the boards differ by more than one exchange could — a new
   *  game, a reload — so nothing should animate at all */
  reset: boolean
}

const FILES = 'abcdefgh'

type Cell = { type: string; color: string } | null

/** 64 cells, a8..h1 — the order chess.js's board() reads out. */
function cells(fen: string): Cell[] {
  return new Chess(fen)
    .board()
    .flat()
    .map((p) => (p ? { type: p.type, color: p.color } : null))
}

function squareAt(index: number): string {
  return `${FILES[index % 8]}${8 - Math.floor(index / 8)}`
}

export function diffChessPositions(prevFen: string | null, fen: string): MoveDiff {
  const none: MoveDiff = { origins: new Map(), moved: new Set(), reset: true }
  if (!prevFen || prevFen === fen) return { ...none, reset: !prevFen }

  const before = cells(prevFen)
  const after = cells(fen)

  const arrived: { square: string; piece: { type: string; color: string } }[] = []
  const departed: { square: string; piece: { type: string; color: string } }[] = []
  for (let i = 0; i < 64; i++) {
    const a = before[i]
    const b = after[i]
    const same = !!a && !!b && a.type === b.type && a.color === b.color
    if (a && !same) departed.push({ square: squareAt(i), piece: a })
    if (b && !same) arrived.push({ square: squareAt(i), piece: b })
  }

  // One ply lands at most two pieces on new squares (castling: king + rook).
  // More than that is a reset — a fresh game, a position jumped wholesale.
  if (arrived.length === 0 || arrived.length > 2) return none

  const origins = new Map<string, string>()
  const pool = [...departed]
  for (const { square, piece } of arrived) {
    // The origin is a vacated square that held this exact piece — or, when a
    // pawn promoted, the vacated square with this colour's pawn.
    let at = pool.findIndex((d) => d.piece.color === piece.color && d.piece.type === piece.type)
    if (at === -1) at = pool.findIndex((d) => d.piece.color === piece.color && d.piece.type === 'p')
    if (at === -1) continue
    origins.set(square, pool[at].square)
    pool.splice(at, 1)
  }

  return { origins, moved: new Set(origins.values()), reset: false }
}
