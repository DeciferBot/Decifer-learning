/**
 * Tests for the server-authoritative move validator behind
 * /api/downtime/games/[id]/move. This is the one place a malicious or buggy
 * client could try to cheat multiplayer Chess/Checkers/Connect 4, so every
 * rejection path gets its own test, not just the happy path.
 */

import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { applyBoardMove, initialBoardState } from '../lib/downtime/move-engine'
import { createInitialBoard as createCheckersBoard } from '../lib/games/checkers-ai'
import { createEmptyBoard as createConnect4Board, dropPiece } from '../lib/games/connect4-ai'

describe('initialBoardState', () => {
  it('chess starts from the standard position', () => {
    const state = initialBoardState('chess') as { fen: string }
    expect(state.fen).toBe(new Chess().fen())
  })

  it('checkers and connect4 start from their engines\' initial boards', () => {
    expect((initialBoardState('checkers') as { board: unknown }).board).toEqual(createCheckersBoard())
    expect((initialBoardState('connect4') as { board: unknown }).board).toEqual(createConnect4Board())
  })
})

describe('applyBoardMove — turn enforcement', () => {
  it('rejects a move from the side that is not turn, for every game type', () => {
    for (const gameType of ['chess', 'checkers', 'connect4'] as const) {
      const state = initialBoardState(gameType)
      const result = applyBoardMove(gameType, state, 'host', 'guest', {})
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe('not_your_turn')
    }
  })
})

describe('applyBoardMove — chess', () => {
  it('host (White) can play the opening move; state advances and turn passes to guest', () => {
    const state = initialBoardState('chess')
    const result = applyBoardMove('chess', state, 'host', 'host', { from: 'e2', to: 'e4' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.turn).toBe('guest')
      expect(result.winner).toBeNull()
      expect((result.state as { fen: string }).fen).not.toBe((state as { fen: string }).fen)
    }
  })

  it('rejects an illegal move (moving into check, or just a fabricated move)', () => {
    const state = initialBoardState('chess')
    const result = applyBoardMove('chess', state, 'host', 'host', { from: 'e2', to: 'e5' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('illegal_move')
  })

  it('rejects malformed move payloads instead of throwing', () => {
    const state = initialBoardState('chess')
    expect(applyBoardMove('chess', state, 'host', 'host', {}).ok).toBe(false)
    expect(applyBoardMove('chess', state, 'host', 'host', { from: 'e2' }).ok).toBe(false)
    expect(applyBoardMove('chess', state, 'host', 'host', { from: 'z9', to: 'z8' }).ok).toBe(false)
    expect(applyBoardMove('chess', state, 'host', 'host', null).ok).toBe(false)
  })

  it('detects checkmate and reports the mover as winner', () => {
    // Fool's mate: fastest checkmate in chess, black (guest) delivers it.
    let state = initialBoardState('chess')
    let r = applyBoardMove('chess', state, 'host', 'host', { from: 'f2', to: 'f3' })
    expect(r.ok).toBe(true); if (!r.ok) return
    state = r.state; expect(r.winner).toBeNull()
    r = applyBoardMove('chess', state, 'guest', 'guest', { from: 'e7', to: 'e5' })
    expect(r.ok).toBe(true); if (!r.ok) return
    state = r.state
    r = applyBoardMove('chess', state, 'host', 'host', { from: 'g2', to: 'g4' })
    expect(r.ok).toBe(true); if (!r.ok) return
    state = r.state
    r = applyBoardMove('chess', state, 'guest', 'guest', { from: 'd8', to: 'h4' })
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.winner).toBe('guest')
    expect(r.turn).toBe('host') // turn still advances even though the game is over
  })
})

describe('applyBoardMove — checkers', () => {
  it('host (Red) moving out of turn order is rejected even with a valid-looking move', () => {
    const state = initialBoardState('checkers')
    // A real red opening move, but it's guest's turn.
    const result = applyBoardMove('checkers', state, 'guest', 'host', { from: [2, 1], to: [3, 0] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('not_your_turn')
  })

  it('accepts a legal opening move and hands the turn to guest', () => {
    const state = initialBoardState('checkers')
    const result = applyBoardMove('checkers', state, 'host', 'host', { from: [2, 1], to: [3, 0] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.turn).toBe('guest')
  })

  it('rejects a move to a square the engine did not offer (spoofed target)', () => {
    const state = initialBoardState('checkers')
    const result = applyBoardMove('checkers', state, 'host', 'host', { from: [2, 1], to: [5, 5] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('illegal_move')
  })

  it('ignores a client-supplied capture list and recomputes it server-side', () => {
    const { board } = createBoardWithForcedCapture()
    const result = applyBoardMove('checkers', { board }, 'host', 'host', {
      from: [2, 2], to: [4, 4], captures: [], // lying about no capture happening
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const next = (result.state as { board: typeof board }).board
      expect(next[3][3]).toBeNull() // the jumped piece is gone regardless of what the client claimed
    }
  })

  it('rejects malformed move payloads', () => {
    const state = initialBoardState('checkers')
    expect(applyBoardMove('checkers', state, 'host', 'host', {}).ok).toBe(false)
    expect(applyBoardMove('checkers', state, 'host', 'host', { from: [2, 1] }).ok).toBe(false)
    expect(applyBoardMove('checkers', state, 'host', 'host', { from: '2,1', to: [3, 0] }).ok).toBe(false)
  })
})

function createBoardWithForcedCapture() {
  const board = createCheckersBoard().map((row) => row.slice())
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) board[r][c] = null
  board[2][2] = { color: 'red', king: false }
  board[3][3] = { color: 'black', king: false }
  return { board }
}

describe('applyBoardMove — connect4', () => {
  it('host (Red) drops first; turn passes to guest', () => {
    const state = initialBoardState('connect4')
    const result = applyBoardMove('connect4', state, 'host', 'host', { col: 3 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.turn).toBe('guest')
  })

  it('rejects a drop into a full column', () => {
    let board = createConnect4Board()
    for (let i = 0; i < 6; i++) board = dropPiece(board, 0, i % 2 === 0 ? 'red' : 'yellow')!.board
    const result = applyBoardMove('connect4', { board }, 'guest', 'guest', { col: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('illegal_move')
  })

  it('rejects a non-integer or out-of-range column', () => {
    const state = initialBoardState('connect4')
    expect(applyBoardMove('connect4', state, 'host', 'host', { col: 1.5 }).ok).toBe(false)
    expect(applyBoardMove('connect4', state, 'host', 'host', { col: 99 }).ok).toBe(false)
    expect(applyBoardMove('connect4', state, 'host', 'host', {}).ok).toBe(false)
  })

  it('detects a four-in-a-row win for the mover', () => {
    let board = createConnect4Board()
    board = dropPiece(board, 0, 'red')!.board
    board = dropPiece(board, 1, 'red')!.board
    board = dropPiece(board, 2, 'red')!.board
    const result = applyBoardMove('connect4', { board }, 'host', 'host', { col: 3 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.winner).toBe('host')
  })
})
