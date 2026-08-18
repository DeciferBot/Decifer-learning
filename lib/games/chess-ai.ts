// A kid-appropriate computer opponent for the Downtime chess game.
//
// Legal moves, check/checkmate/stalemate/draw detection, and FEN handling all
// come from chess.js — a small, dependency-free, offline-capable library.
// Chess's full rule set (castling, en passant, promotion, the fifty-move
// rule) is exactly the kind of thing that's easy to get subtly wrong by
// hand and hard to fully verify without a large test suite; chess.js is
// the standard, well-tested solution, so this file only adds move
// SELECTION, not move legality.
//
// The one thing this file owns: picking a move that is fun to play against.
// A maximum-strength engine is not the goal — Duolingo Chess's own design
// principle (see docs/research/DUOLINGO_MECHANICS_2026-08.md) is an
// opponent whose strength adapts to the learner, not one that always wins.
// A 7-year-old and a 12-year-old should both be able to beat "Easy" and
// both be tested by "Hard".

import { Chess } from 'chess.js'

export type ChessDifficulty = 'easy' | 'medium' | 'hard'

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0, // king safety is handled by checkmate detection, not material value
}

// Small positional nudge: centre squares are worth slightly more than the
// edge, for every piece except the king. This is a well-known, simple
// heuristic (not a full piece-square table) — enough to stop the engine
// shuffling a rook to the corner for no reason, without pretending to be a
// strong engine.
const CENTRE_BONUS: Record<string, number> = {
  a: 0, b: 4, c: 8, d: 12, e: 12, f: 8, g: 4, h: 0,
}

function centreScore(square: string): number {
  const file = square[0]
  const rank = Number(square[1])
  const rankBonus = rank >= 3 && rank <= 6 ? 4 : 0
  return (CENTRE_BONUS[file] ?? 0) + rankBonus
}

/** Material + light positional evaluation, from White's perspective. */
function evaluate(game: Chess): number {
  if (game.isCheckmate()) {
    // The side to move is checkmated, i.e. has just lost.
    return game.turn() === 'w' ? -100000 : 100000
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return 0
  }

  let score = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue
      const value = (PIECE_VALUE[piece.type] ?? 0) + centreScore(piece.square)
      score += piece.color === 'w' ? value : -value
    }
  }
  return score
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluate(game)
  }

  const moves = game.moves()
  if (maximizing) {
    let best = -Infinity
    for (const move of moves) {
      game.move(move)
      best = Math.max(best, minimax(game, depth - 1, alpha, beta, false))
      game.undo()
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  }
  let best = Infinity
  for (const move of moves) {
    game.move(move)
    best = Math.min(best, minimax(game, depth - 1, alpha, beta, true))
    game.undo()
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

// Search depth and "how often does it just play a reasonable-but-not-best
// move" both scale with difficulty, so Easy loses on purpose sometimes
// rather than only ever losing to a shallow search running out of moves to
// see. depth is plies (one player's move).
//
// Capped at depth 2 for every tier, deliberately: this runs synchronously on
// the browser's main thread (no Web Worker), and a measured worst case of
// ~1.6s at depth 3 on a busy middlegame position on this machine could be
// considerably longer on an older phone or tablet — long enough to look
// like the page has frozen. Depth 2 measured under 300ms even in a busy
// position, comfortably safe, and is still a meaningfully different (and
// beatable) opponent from depth 1 — appropriate for a family downtime game,
// not a competition engine.
const DIFFICULTY: Record<ChessDifficulty, { depth: number; blunderChance: number }> = {
  easy: { depth: 1, blunderChance: 0.35 },
  medium: { depth: 2, blunderChance: 0.15 },
  hard: { depth: 2, blunderChance: 0 },
}

/**
 * Picks the computer's move for the current position. Returns the move's SAN
 * string (e.g. "Nf3"), or null if the game already has no legal moves
 * (checkmate/stalemate — the caller should have stopped play already).
 */
export function pickComputerMove(fen: string, difficulty: ChessDifficulty): string | null {
  const game = new Chess(fen)
  const legalMoves = game.moves()
  if (legalMoves.length === 0) return null

  const { depth, blunderChance } = DIFFICULTY[difficulty]
  const maximizing = game.turn() === 'w'

  // A genuine random legal move, occasionally, instead of the search result —
  // this is what makes Easy actually losable rather than just "a weak
  // search that still never blunders a piece".
  if (blunderChance > 0 && Math.random() < blunderChance) {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)]
  }

  let bestMove: string | null = null
  let bestScore = maximizing ? -Infinity : Infinity

  // Shuffle so that among equally-scored moves the engine doesn't always
  // play the first one chess.js happens to generate (visibly repetitive).
  const shuffled = [...legalMoves].sort(() => Math.random() - 0.5)

  for (const move of shuffled) {
    game.move(move)
    const score = minimax(game, depth - 1, -Infinity, Infinity, !maximizing)
    game.undo()
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove ?? shuffled[0]
}
