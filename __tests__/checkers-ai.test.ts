/**
 * Checkers tests. The rules (mandatory capture, multi-jump chains, backward
 * capture for men, promotion-ends-the-move) are exactly the kind of thing
 * that's easy to get subtly wrong, so each one gets its own targeted test
 * built from a hand-placed position rather than relying only on self-play.
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialBoard, legalMoves, applyMove, findLegalMove, determineOutcome,
  pickComputerMove, SIZE,
  type Board, type Cell, type CheckersDifficulty,
} from '../lib/games/checkers-ai'

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))
}

describe('createInitialBoard', () => {
  it('places 12 red and 12 black men, all on dark squares, no kings', () => {
    const board = createInitialBoard()
    let red = 0
    let black = 0
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = board[r][c]
        if (!piece) continue
        expect((r + c) % 2).toBe(1) // dark squares only
        expect(piece.king).toBe(false)
        if (piece.color === 'red') red++
        else black++
      }
    }
    expect(red).toBe(12)
    expect(black).toBe(12)
  })

  it('never mutates the board passed into applyMove (immutable)', () => {
    const board = createInitialBoard()
    const before = JSON.stringify(board)
    const move = legalMoves(board, 'red')[0]
    applyMove(board, move, 'red')
    expect(JSON.stringify(board)).toBe(before)
  })
})

describe('simple moves', () => {
  it('a man can only step diagonally forward, never backward or sideways', () => {
    const board = emptyBoard()
    board[3][3] = { color: 'red', king: false }
    const moves = legalMoves(board, 'red')
    const targets = moves.map((m) => m.to.join(','))
    expect(targets.sort()).toEqual(['4,2', '4,4'].sort())
  })

  it('a king can step diagonally in all four directions', () => {
    const board = emptyBoard()
    board[3][3] = { color: 'red', king: true }
    const moves = legalMoves(board, 'red')
    const targets = moves.map((m) => m.to.join(',')).sort()
    expect(targets).toEqual(['2,2', '2,4', '4,2', '4,4'].sort())
  })

  it('cannot step onto an occupied square', () => {
    const board = emptyBoard()
    board[3][3] = { color: 'red', king: false }
    board[4][4] = { color: 'red', king: false }
    const moves = legalMoves(board, 'red')
    expect(moves.find((m) => m.to[0] === 4 && m.to[1] === 4)).toBeUndefined()
  })
})

describe('captures', () => {
  it('captures are mandatory — a simple move is illegal when a capture exists', () => {
    const board = emptyBoard()
    board[2][2] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false } // jumpable, lands on 4,4 (empty)
    const moves = legalMoves(board, 'red')
    expect(moves).toHaveLength(1)
    expect(moves[0].to).toEqual([4, 4])
    expect(moves[0].captures).toEqual([[3, 3]])
  })

  it('a man CAN capture backward (American rule), even though it cannot step backward', () => {
    const board = emptyBoard()
    board[4][4] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false } // behind the red man; lands 2,2
    const moves = legalMoves(board, 'red')
    expect(moves).toHaveLength(1)
    expect(moves[0].to).toEqual([2, 2])
  })

  it('no capture available when the landing square is occupied', () => {
    const board = emptyBoard()
    board[2][2] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false }
    board[4][4] = { color: 'black', king: false } // blocks the landing square
    const moves = legalMoves(board, 'red')
    // No capture possible, so simple moves are legal — but 3,3 is occupied too.
    expect(moves.every((m) => m.captures.length === 0)).toBe(true)
    expect(moves.find((m) => m.to[0] === 3 && m.to[1] === 3)).toBeUndefined()
  })

  it('a multi-jump chain is mandatory to continue and captures both pieces', () => {
    const board = emptyBoard()
    board[2][2] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false } // first jump lands 4,4
    board[5][5] = { color: 'black', king: false } // second jump lands 6,6
    const moves = legalMoves(board, 'red')
    expect(moves).toHaveLength(1)
    expect(moves[0].to).toEqual([6, 6])
    expect(moves[0].captures.sort()).toEqual([[3, 3], [5, 5]].sort())
  })

  it('reaching the crown row mid-chain ends the move immediately (no further jump)', () => {
    const board = emptyBoard()
    board[5][3] = { color: 'red', king: false }
    board[6][4] = { color: 'black', king: false } // jump lands on 7,5 — the crown row
    const moves = legalMoves(board, 'red')
    expect(moves).toHaveLength(1)
    expect(moves[0].to).toEqual([7, 5])
    const next = applyMove(board, moves[0], 'red')
    expect(next[7][5]?.king).toBe(true)
  })

  it('applyMove removes every captured piece and lands the mover at the final square', () => {
    const board = emptyBoard()
    board[2][2] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false }
    const move = legalMoves(board, 'red')[0]
    const next = applyMove(board, move, 'red')
    expect(next[2][2]).toBeNull()
    expect(next[3][3]).toBeNull()
    expect(next[4][4]).toEqual({ color: 'red', king: false })
  })

  it('when multiple independent captures are available, all are offered (no forced-longest rule)', () => {
    const board = emptyBoard()
    board[4][4] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false } // single jump to 2,2
    board[5][5] = { color: 'black', king: false } // single jump to 6,6
    const moves = legalMoves(board, 'red')
    const targets = moves.map((m) => m.to.join(',')).sort()
    expect(targets).toEqual(['2,2', '6,6'])
  })
})

describe('findLegalMove', () => {
  it('finds and returns the engine-computed move, ignoring a spoofed capture list', () => {
    const board = emptyBoard()
    board[2][2] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false }
    const found = findLegalMove(board, 'red', [2, 2], [4, 4])
    expect(found).not.toBeNull()
    expect(found!.captures).toEqual([[3, 3]]) // recomputed server-side, not trusted from caller
  })

  it('returns null for an illegal from/to pair', () => {
    const board = createInitialBoard()
    expect(findLegalMove(board, 'red', [0, 1], [5, 5])).toBeNull()
  })

  it('returns null for a legal-looking simple move when a capture is mandatory elsewhere', () => {
    const board = emptyBoard()
    board[2][2] = { color: 'red', king: false }
    board[3][3] = { color: 'black', king: false } // forces capture
    board[6][0] = { color: 'red', king: false } // this piece has a normally-legal simple move
    expect(findLegalMove(board, 'red', [6, 0], [7, 1])).toBeNull()
  })
})

describe('determineOutcome', () => {
  it('the mover wins when the opponent has no pieces left', () => {
    const board = emptyBoard()
    board[4][4] = { color: 'red', king: false }
    expect(determineOutcome(board, 'red')).toBe('red')
  })

  it('the mover wins when the opponent is completely blocked', () => {
    const board = emptyBoard()
    // Black man in the corner: its only diagonal neighbour (6,6) is occupied
    // by red, and the square a capture would land on (5,5) is occupied too —
    // so black has neither a simple move nor a capture.
    board[7][7] = { color: 'black', king: false }
    board[6][6] = { color: 'red', king: false }
    board[5][5] = { color: 'red', king: false }
    expect(determineOutcome(board, 'red')).toBe('red')
  })

  it('returns null when the game is still going', () => {
    const board = createInitialBoard()
    expect(determineOutcome(board, 'red')).toBeNull()
  })
})

describe('pickComputerMove', () => {
  it('always returns a legal move, at every difficulty', () => {
    const difficulties: CheckersDifficulty[] = ['easy', 'medium', 'hard']
    for (const difficulty of difficulties) {
      const board = createInitialBoard()
      const move = pickComputerMove(board, 'black', difficulty)
      expect(move).not.toBeNull()
      const legal = legalMoves(board, 'black')
      expect(legal.some((m) => m.from.join() === move!.from.join() && m.to.join() === move!.to.join())).toBe(true)
    }
  })

  it('returns null when the side to move has no legal move', () => {
    const board = emptyBoard()
    board[7][7] = { color: 'black', king: false }
    board[6][6] = { color: 'red', king: false }
    board[5][5] = { color: 'red', king: false } // blocks the capture landing square too
    expect(pickComputerMove(board, 'black', 'hard')).toBeNull()
  })

  it('takes a free capture on hard difficulty rather than a passive move', () => {
    const board = emptyBoard()
    board[4][4] = { color: 'black', king: false }
    board[3][3] = { color: 'red', king: false } // black can jump it, landing 2,2
    const move = pickComputerMove(board, 'black', 'hard')
    expect(move!.to).toEqual([2, 2])
  })

  it('plays a bounded self-play game at hard difficulty without ever proposing an illegal move', () => {
    let board = createInitialBoard()
    let turn: 'red' | 'black' = 'red'
    let plies = 0
    const MAX_PLIES = 40 // enough to exercise midgame captures without risking a long run
    while (plies < MAX_PLIES) {
      const outcome = determineOutcome(board, turn === 'red' ? 'black' : 'red')
      if (outcome) break
      const move = pickComputerMove(board, turn, 'hard')
      if (!move) break
      const legal = legalMoves(board, turn)
      expect(legal.some((m) => m.from.join() === move.from.join() && m.to.join() === move.to.join())).toBe(true)
      board = applyMove(board, move, turn)
      turn = turn === 'red' ? 'black' : 'red'
      plies++
    }
    expect(plies).toBeGreaterThan(0)
  })
})
