/**
 * diffChessPositions drives the board's move animation, so each of the
 * fiddly chess cases is pinned: a plain move, a capture (the taken piece
 * must NOT be treated as having moved — it fades, it doesn't slide),
 * castling (king AND rook slide), en passant (the captured pawn's square is
 * neither an origin nor a destination), promotion (the queen slides from
 * the pawn's square), and a reset (nothing animates).
 */

import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { diffChessPositions } from '@/lib/games/chess-move-diff'

function play(moves: string[]): { before: string; after: string } {
  const g = new Chess()
  for (const m of moves.slice(0, -1)) g.move(m)
  const before = g.fen()
  g.move(moves[moves.length - 1])
  return { before, after: g.fen() }
}

describe('diffChessPositions', () => {
  it('maps a simple move to its origin', () => {
    const { before, after } = play(['e4'])
    const diff = diffChessPositions(before, after)
    expect(diff.reset).toBe(false)
    expect(diff.origins.get('e4')).toBe('e2')
    expect(diff.moved).toEqual(new Set(['e2']))
  })

  it('a capture slides the taker; the taken square is not "moved"', () => {
    const { before, after } = play(['e4', 'd5', 'exd5'])
    const diff = diffChessPositions(before, after)
    expect(diff.origins.get('d5')).toBe('e4')
    expect(diff.moved).toEqual(new Set(['e4'])) // d5's old pawn was captured, not moved
  })

  it('castling slides both the king and the rook', () => {
    const { before, after } = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'])
    const diff = diffChessPositions(before, after)
    expect(diff.origins.get('g1')).toBe('e1')
    expect(diff.origins.get('f1')).toBe('h1')
    expect(diff.moved).toEqual(new Set(['e1', 'h1']))
  })

  it('en passant: the captured pawn fades in place, off the mover\'s path', () => {
    const { before, after } = play(['e4', 'a6', 'e5', 'd5', 'exd6'])
    const diff = diffChessPositions(before, after)
    expect(diff.origins.get('d6')).toBe('e5')
    // d5's pawn was captured without anyone landing there: not an origin,
    // not a destination, so the board fades it rather than sliding it.
    expect(diff.moved).toEqual(new Set(['e5']))
    expect(diff.origins.has('d5')).toBe(false)
  })

  it('promotion slides the new queen from the pawn\'s square', () => {
    const before = '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1'
    const g = new Chess(before)
    g.move('b8=Q')
    const diff = diffChessPositions(before, g.fen())
    expect(diff.origins.get('b8')).toBe('b7')
    expect(diff.moved).toEqual(new Set(['b7']))
  })

  it('treats a jump to an unrelated position as a reset', () => {
    const midGame = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']).after
    const diff = diffChessPositions(midGame, new Chess().fen())
    expect(diff.reset).toBe(true)
    expect(diff.origins.size).toBe(0)
  })

  it('no previous position means nothing to animate', () => {
    const diff = diffChessPositions(null, new Chess().fen())
    expect(diff.reset).toBe(true)
    expect(diff.origins.size).toBe(0)
  })

  it('an unchanged position is quiet without being a reset', () => {
    const fen = new Chess().fen()
    const diff = diffChessPositions(fen, fen)
    expect(diff.reset).toBe(false)
    expect(diff.origins.size).toBe(0)
    expect(diff.moved.size).toBe(0)
  })
})
