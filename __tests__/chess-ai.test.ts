/**
 * pickComputerMove tests. The one thing this file must never do is return a
 * move chess.js itself doesn't consider legal — every other product
 * guarantee (fun to play, beatable on Easy, no infinite hang) depends on
 * that holding first.
 */

import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { pickComputerMove, type ChessDifficulty } from '../lib/games/chess-ai'

const DIFFICULTIES: ChessDifficulty[] = ['easy', 'medium', 'hard']
const START_FEN = new Chess().fen()

describe('pickComputerMove', () => {
  it('always returns a move chess.js considers legal, at every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const game = new Chess(START_FEN)
      const move = pickComputerMove(game.fen(), difficulty)
      expect(move).not.toBeNull()
      const legal = game.moves()
      expect(legal).toContain(move)
    }
  })

  it('returns null when there are no legal moves (checkmate)', () => {
    // Fool's mate position — black has just delivered checkmate, white to
    // move with no legal replies.
    const game = new Chess()
    game.move('f3')
    game.move('e5')
    game.move('g4')
    game.move('Qh4') // checkmate
    expect(game.isCheckmate()).toBe(true)
    const move = pickComputerMove(game.fen(), 'hard')
    expect(move).toBeNull()
  })

  it('takes a free queen when playing on hard difficulty', () => {
    // White queen sits on h5, undefended, capturable by black's knight on
    // f6. Any reasonable search should see a 900-point capture is worth
    // taking over quiet development moves.
    const game = new Chess('rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 2 2')
    const move = pickComputerMove(game.fen(), 'hard')
    expect(move).toBe('Nxh5')
  })

  it('plays a full game against itself at hard difficulty without ever producing an illegal move', () => {
    const game = new Chess()
    let plies = 0
    // 12 plies (6 full moves) is enough to exercise ordinary opening play
    // and at least one capture without turning this into a performance test.
    while (!game.isGameOver() && plies < 12) {
      const move = pickComputerMove(game.fen(), 'hard')
      expect(move).not.toBeNull()
      const result = game.move(move as string) // throws if chess.js rejects it
      expect(result).not.toBeNull()
      plies++
    }
    expect(plies).toBeGreaterThan(0)
  })

  it('easy difficulty sometimes deviates from the best move over many draws (blunder chance is live)', () => {
    // Same free-queen position as above. Hard always takes it; Easy should
    // occasionally not, since blunderChance=0.35. This is inherently
    // probabilistic — run enough trials that a false failure is
    // astronomically unlikely (0.65^40 ≈ 4e-8) while still finishing fast.
    const fen = 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 2 2'
    let sawNonBestMove = false
    for (let i = 0; i < 40; i++) {
      const move = pickComputerMove(fen, 'easy')
      if (move !== 'Nxh5') {
        sawNonBestMove = true
        break
      }
    }
    expect(sawNonBestMove).toBe(true)
  })
})
