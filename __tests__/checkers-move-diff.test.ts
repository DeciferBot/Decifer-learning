/**
 * diffCheckersPositions drives the checkers board's move animation. Pinned
 * cases: a simple move, a single jump (the jumped disc fades in place — it
 * is not "moved"), a multi-jump (one slide across the whole chain, every
 * jumped disc fading), crowning (the new king slides from the man's
 * square), and a reset (nothing animates).
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialBoard, legalMoves, applyMove, type Board, type CheckersColor,
} from '@/lib/games/checkers-ai'
import { diffCheckersPositions } from '@/lib/games/checkers-move-diff'

const SIZE = 8

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
}

function place(board: Board, r: number, c: number, color: CheckersColor, king = false): Board {
  const next = board.map((row) => [...row])
  next[r][c] = { color, king }
  return next
}

function playFirstLegal(board: Board, color: CheckersColor): { before: Board; after: Board } {
  const move = legalMoves(board, color)[0]
  return { before: board, after: applyMove(board, move, color) }
}

describe('diffCheckersPositions', () => {
  it('maps a simple move to its origin', () => {
    const { before, after } = playFirstLegal(createInitialBoard(), 'red')
    const diff = diffCheckersPositions(before, after)
    expect(diff.reset).toBe(false)
    expect(diff.origins.size).toBe(1)
    const [dest, origin] = [...diff.origins.entries()][0]
    expect(diff.moved).toEqual(new Set([origin]))
    expect(dest).not.toBe(origin)
  })

  it('a jump slides the jumper; the jumped disc fades in place', () => {
    let board = emptyBoard()
    board = place(board, 2, 3, 'red')
    board = place(board, 3, 4, 'black')
    const { before, after } = playFirstLegal(board, 'red') // 2,3 jumps to 4,5
    const diff = diffCheckersPositions(before, after)
    expect(diff.origins.get('4,5')).toBe('2,3')
    expect(diff.moved).toEqual(new Set(['2,3'])) // 3,4 was captured, not moved
  })

  it('a multi-jump is one slide across the chain, all jumped discs fading', () => {
    let board = emptyBoard()
    board = place(board, 0, 1, 'red')
    board = place(board, 1, 2, 'black')
    board = place(board, 3, 4, 'black')
    const { before, after } = playFirstLegal(board, 'red') // 0,1 -> 2,3 -> 4,5
    const diff = diffCheckersPositions(before, after)
    expect(diff.origins.get('4,5')).toBe('0,1')
    expect(diff.moved).toEqual(new Set(['0,1']))
  })

  it('crowning slides the new king from the man\'s square', () => {
    let board = emptyBoard()
    board = place(board, 6, 1, 'red')
    board = place(board, 0, 0, 'black') // black needs a piece or red has already won
    const { before, after } = playFirstLegal(board, 'red') // reaches row 7, crowned
    const diff = diffCheckersPositions(before, after)
    const [dest, origin] = [...diff.origins.entries()][0]
    expect(origin).toBe('6,1')
    expect(dest.startsWith('7,')).toBe(true)
    expect(after[7][Number(dest.split(',')[1])]?.king).toBe(true)
  })

  it('treats a jump to an unrelated position as a reset', () => {
    // Play several plies so the mid-game board differs from the fresh one
    // by more than a move or two — only then is "new game" distinguishable
    // from a normal exchange.
    let board = createInitialBoard()
    let turn: CheckersColor = 'red'
    for (let ply = 0; ply < 6; ply++) {
      board = applyMove(board, legalMoves(board, turn)[0], turn)
      turn = turn === 'red' ? 'black' : 'red'
    }
    const diff = diffCheckersPositions(board, createInitialBoard())
    expect(diff.reset).toBe(true)
    expect(diff.origins.size).toBe(0)
  })

  it('no previous board means nothing to animate', () => {
    const diff = diffCheckersPositions(null, createInitialBoard())
    expect(diff.reset).toBe(true)
    expect(diff.origins.size).toBe(0)
  })

  it('an unchanged board is quiet without being a reset', () => {
    const board = createInitialBoard()
    const diff = diffCheckersPositions(board, board.map((row) => [...row]))
    expect(diff.reset).toBe(false)
    expect(diff.origins.size).toBe(0)
    expect(diff.moved.size).toBe(0)
  })
})
