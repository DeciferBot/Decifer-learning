import { Chess, type Square } from 'chess.js'

/** What each side starts with, kings excluded (a king is never captured). */
const FULL_SET: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const

export type Captured = { white: string[]; black: string[] }

/**
 * Which pieces each side has lost, derived from the position rather than
 * tracked in state — anything missing from a full set has been taken. That
 * keeps it correct after an undo, a reload, or a board handed over by the
 * server mid-game.
 *
 * `Math.max(0, …)` is load-bearing. Promotion can put more of a piece on the
 * board than the set began with, and this game always promotes to a queen, so
 * a promoted pawn gives 1 - 2 = -1 queens captured. Passing that to
 * `Array(-1)` throws RangeError and took the whole board down with it.
 *
 * Lives here rather than in the component so it can be tested: the bug above
 * shipped precisely because it sat inside a 'use client' file that the
 * node-only test suite could not reach.
 */
export function capturedMaterial(fen: string): Captured {
  const board = new Chess(fen)
  const remaining: Record<'w' | 'b', Record<string, number>> = { w: {}, b: {} }

  for (const rank of RANKS) {
    for (const file of FILES) {
      const piece = board.get(`${file}${rank}` as Square)
      if (!piece || piece.type === 'k') continue
      remaining[piece.color][piece.type] = (remaining[piece.color][piece.type] ?? 0) + 1
    }
  }

  const lost = (colour: 'w' | 'b') =>
    Object.entries(FULL_SET).flatMap(([type, n]) =>
      Array(Math.max(0, n - (remaining[colour][type] ?? 0))).fill(type) as string[],
    )

  return { white: lost('w'), black: lost('b') }
}
