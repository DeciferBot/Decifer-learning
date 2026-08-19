/**
 * Connect 4 tests. Unlike chess (which delegates rules to chess.js), the
 * win-detection and drop logic here are hand-written, so they get the same
 * scrutiny an external library would otherwise have already earned.
 */

import { describe, it, expect } from 'vitest'
import {
  createEmptyBoard, dropPiece, landingRow, legalColumns, isBoardFull,
  winnerAt, findWinner, pickComputerColumn,
  type Board, type Connect4Difficulty,
} from '../lib/games/connect4-ai'

function boardFromRows(rows: string[]): Board {
  // Each string is one row, TOP row first (as a human would read a printed
  // board), 'r'/'y'/'.' per cell — reversed here since the engine stores
  // row 0 as the bottom.
  const parsed = rows.map((r) =>
    r.split('').map((c) => (c === 'r' ? 'red' : c === 'y' ? 'yellow' : null)),
  )
  return parsed.reverse()
}

describe('dropPiece / landingRow', () => {
  it('lands on the bottom row of an empty column', () => {
    const board = createEmptyBoard()
    expect(landingRow(board, 3)).toBe(0)
  })

  it('stacks on top of existing pieces', () => {
    let board = createEmptyBoard()
    board = dropPiece(board, 3, 'red')!.board
    board = dropPiece(board, 3, 'yellow')!.board
    const result = dropPiece(board, 3, 'red')!
    expect(result.row).toBe(2)
  })

  it('returns null when the column is full', () => {
    let board = createEmptyBoard()
    for (let i = 0; i < 6; i++) {
      board = dropPiece(board, 0, i % 2 === 0 ? 'red' : 'yellow')!.board
    }
    expect(dropPiece(board, 0, 'red')).toBeNull()
    expect(landingRow(board, 0)).toBe(-1)
  })

  it('never mutates the board passed in (immutable drop)', () => {
    const board = createEmptyBoard()
    const before = JSON.stringify(board)
    dropPiece(board, 2, 'red')
    expect(JSON.stringify(board)).toBe(before)
  })
})

describe('legalColumns / isBoardFull', () => {
  it('all 7 columns are legal on an empty board', () => {
    expect(legalColumns(createEmptyBoard())).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('a full column drops out of legalColumns', () => {
    let board = createEmptyBoard()
    for (let i = 0; i < 6; i++) board = dropPiece(board, 4, 'red')!.board
    expect(legalColumns(board)).not.toContain(4)
  })

  it('isBoardFull is true only when every column is full', () => {
    let board = createEmptyBoard()
    expect(isBoardFull(board)).toBe(false)
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row < 6; row++) {
        board = dropPiece(board, col, (row + col) % 2 === 0 ? 'red' : 'yellow')!.board
      }
    }
    expect(isBoardFull(board)).toBe(true)
  })
})

describe('winnerAt / findWinner', () => {
  it('detects a horizontal four', () => {
    const board = boardFromRows([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'rrrr...',
    ])
    expect(findWinner(board)).toBe('red')
    expect(winnerAt(board, 0, 2)).toBe('red')
  })

  it('detects a vertical four', () => {
    let board = createEmptyBoard()
    for (let i = 0; i < 4; i++) board = dropPiece(board, 1, 'yellow')!.board
    expect(findWinner(board)).toBe('yellow')
  })

  it('detects an ascending diagonal (/)', () => {
    // Build a red diagonal at (0,0),(1,1),(2,2),(3,3) by stacking one extra
    // yellow filler under each successive column before dropping the red —
    // built via real drops rather than hand-drawn ASCII, so the geometry
    // can't be miscounted.
    let board = createEmptyBoard()
    board = dropPiece(board, 0, 'red')!.board // (0,0) red
    board = dropPiece(board, 1, 'yellow')!.board
    board = dropPiece(board, 1, 'red')!.board // (1,1) red
    board = dropPiece(board, 2, 'yellow')!.board
    board = dropPiece(board, 2, 'yellow')!.board
    board = dropPiece(board, 2, 'red')!.board // (2,2) red
    board = dropPiece(board, 3, 'yellow')!.board
    board = dropPiece(board, 3, 'yellow')!.board
    board = dropPiece(board, 3, 'yellow')!.board
    board = dropPiece(board, 3, 'red')!.board // (3,3) red
    expect(board[0][0]).toBe('red')
    expect(board[1][1]).toBe('red')
    expect(board[2][2]).toBe('red')
    expect(board[3][3]).toBe('red')
    expect(findWinner(board)).toBe('red')
    expect(winnerAt(board, 3, 3)).toBe('red')
  })

  it('three in a row is not a win', () => {
    const board = boardFromRows([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'rrr....',
    ])
    expect(findWinner(board)).toBeNull()
  })

  it('a gap breaks the run', () => {
    const board = boardFromRows([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'rrr.rrr',
    ])
    expect(findWinner(board)).toBeNull()
  })

  it('winnerAt only reports a win through the given square', () => {
    const board = boardFromRows([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'rrrr...',
    ])
    expect(winnerAt(board, 0, 5)).toBeNull() // empty square, no piece there
  })
})

describe('pickComputerColumn', () => {
  it('always returns a legal column, at every difficulty', () => {
    const difficulties: Connect4Difficulty[] = ['easy', 'medium', 'hard']
    for (const difficulty of difficulties) {
      const board = createEmptyBoard()
      const col = pickComputerColumn(board, 'yellow', difficulty)
      expect(col).not.toBeNull()
      expect(legalColumns(board)).toContain(col)
    }
  })

  it('returns null when the board is full', () => {
    let board = createEmptyBoard()
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row < 6; row++) {
        board = dropPiece(board, col, (row + col) % 2 === 0 ? 'red' : 'yellow')!.board
      }
    }
    expect(pickComputerColumn(board, 'yellow', 'hard')).toBeNull()
  })

  it('takes an immediate winning move on hard difficulty', () => {
    // Yellow has three in a row at the bottom (cols 0-2); col 3 wins.
    const board = boardFromRows([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'yyy....',
    ])
    const col = pickComputerColumn(board, 'yellow', 'hard')
    expect(col).toBe(3)
  })

  it('blocks the opponent\'s immediate winning move on hard difficulty', () => {
    // Red has three in a row; yellow (to move) must play col 3 or lose next turn.
    const board = boardFromRows([
      '.......',
      '.......',
      '.......',
      '.......',
      '.......',
      'rrr....',
    ])
    const col = pickComputerColumn(board, 'yellow', 'hard')
    expect(col).toBe(3)
  })

  // Full minimax self-play: ~5s on an idle machine, more on a busy one, so
  // it needs a real budget rather than vitest's 5s default.
  it('plays a full game against itself at hard difficulty without ever landing in a full column', () => {
    let board = createEmptyBoard()
    let turn: 'red' | 'yellow' = 'red'
    let moves = 0
    while (!findWinner(board) && !isBoardFull(board) && moves < 42) {
      const col = pickComputerColumn(board, turn, 'hard')
      expect(col).not.toBeNull()
      const result = dropPiece(board, col as number, turn)
      expect(result).not.toBeNull()
      board = result!.board
      turn = turn === 'red' ? 'yellow' : 'red'
      moves++
    }
    expect(moves).toBeGreaterThan(0)
  }, 30_000)
})
