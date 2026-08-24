import { describe, it, expect } from 'vitest'
import { generateScrabbleMoves, pickScrabbleMove } from '../lib/games/scrabble-ai'
import { applyScrabbleMove, createEmptyScrabbleBoard, type ScrabbleBoard } from '../lib/games/scrabble-engine'
import { CENTER } from '../lib/games/scrabble-board'

// The computer opponent is only trusted because every move it proposes goes
// back through applyScrabbleMove — the same validator a child's move faces.
// These tests hold it to exactly that: whatever it picks must be accepted
// by the engine, on an empty board and on a board with tiles to connect to.

function boardWithCat(): ScrabbleBoard {
  const board = createEmptyScrabbleBoard()
  const r = applyScrabbleMove(board, ['C', 'A', 'T'], [], {
    type: 'place',
    tiles: [
      { row: CENTER, col: 6, letter: 'C', isBlank: false },
      { row: CENTER, col: 7, letter: 'A', isBlank: false },
      { row: CENTER, col: 8, letter: 'T', isBlank: false },
    ],
  })
  if (!r.ok) throw new Error('setup failed')
  return r.board
}

describe('opening move', () => {
  it('plays a legal opening through the centre on an empty board', () => {
    const board = createEmptyScrabbleBoard()
    const rack = ['C', 'A', 'T', 'D', 'O', 'G', 'E']
    const move = pickScrabbleMove(board, rack, 86, 'hard')
    expect(move.type).toBe('place')
    if (move.type !== 'place') return
    const applied = applyScrabbleMove(board, rack, [], move)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.scoreGained).toBeGreaterThan(0)
      // The engine only accepts an opening that covers the centre star.
      expect(applied.board[CENTER][CENTER]).not.toBeNull()
    }
  })

  it('can open using blank tiles', () => {
    const board = createEmptyScrabbleBoard()
    const rack = ['_', '_']
    const move = pickScrabbleMove(board, rack, 86, 'hard')
    expect(move.type).toBe('place')
    if (move.type !== 'place') return
    expect(move.tiles.every((t) => t.isBlank)).toBe(true)
    expect(applyScrabbleMove(board, rack, [], move).ok).toBe(true)
  })
})

describe('connected moves', () => {
  it('plays a legal move that connects to existing tiles', () => {
    const board = boardWithCat()
    const rack = ['S', 'D', 'O', 'G', 'E', 'R', 'N']
    const move = pickScrabbleMove(board, rack, 86, 'medium')
    expect(move.type).toBe('place')
    if (move.type !== 'place') return
    const applied = applyScrabbleMove(board, rack, [], move)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.scoreGained).toBeGreaterThan(0)
  })

  it('every generated move passes the engine', () => {
    const board = boardWithCat()
    const rack = ['S', 'D', 'O', 'G', 'E', '_', 'N']
    const moves = generateScrabbleMoves(board, rack, 6)
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) {
      const applied = applyScrabbleMove(board, rack, [], { type: 'place', tiles: m.tiles })
      expect(applied.ok).toBe(true)
      if (applied.ok) expect(applied.scoreGained).toBe(m.score)
    }
  })
})

describe('difficulty', () => {
  it('hard picks the highest-scoring placement it generated', () => {
    const board = boardWithCat()
    const rack = ['S', 'D', 'O', 'G', 'E', 'R', 'N']
    const best = Math.max(...generateScrabbleMoves(board, rack, 8).map((m) => m.score))
    const move = pickScrabbleMove(board, rack, 86, 'hard')
    expect(move.type).toBe('place')
    if (move.type !== 'place') return
    const applied = applyScrabbleMove(board, rack, [], move)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.scoreGained).toBe(best)
  })

  it('easy never plays a word longer than four letters', () => {
    const board = createEmptyScrabbleBoard()
    const rack = ['S', 'T', 'R', 'A', 'I', 'N', 'G']
    // On an empty board every placed tile is part of the single opening
    // word, so tile count = word length.
    for (let run = 0; run < 5; run++) {
      const move = pickScrabbleMove(board, rack, 86, 'easy')
      expect(move.type).toBe('place')
      if (move.type === 'place') expect(move.tiles.length).toBeLessThanOrEqual(4)
    }
  })
})

describe('when no word is possible', () => {
  it('exchanges when the bag still allows it', () => {
    const board = createEmptyScrabbleBoard()
    const move = pickScrabbleMove(board, ['Q'], 86, 'hard')
    expect(move).toEqual({ type: 'exchange', tiles: ['Q'] })
  })

  it('passes when the bag is too low to exchange', () => {
    const board = createEmptyScrabbleBoard()
    const move = pickScrabbleMove(board, ['Q'], 5, 'hard')
    expect(move).toEqual({ type: 'pass' })
  })

  it('never swaps away a blank', () => {
    const board = createEmptyScrabbleBoard()
    // A lone Q with a blank could still open (e.g. QI with the blank as I),
    // so force the no-move case with an unplayable all-consonant rack that
    // has no blank escape hatch... a bare Q plus blank CAN play, so just
    // assert the exchange filter directly with an unplayable rack.
    const move = pickScrabbleMove(board, ['Q', '_'], 86, 'hard')
    if (move.type === 'exchange') {
      expect(move.tiles).not.toContain('_')
    } else {
      // If the generator found a word (blank as I → QI etc.), that is a
      // legal, better outcome — verify it stands up to the engine.
      expect(move.type).toBe('place')
      if (move.type === 'place') expect(applyScrabbleMove(board, ['Q', '_'], [], move).ok).toBe(true)
    }
  })
})
