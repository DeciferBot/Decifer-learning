// Checkers (American / English draughts) rules + a minimax computer opponent.
// Like Connect 4, the rule set is small enough to hand-write and fully
// unit-test — no external library needed.
//
// Rules implemented (standard American checkers):
//  - 8x8 board, pieces on dark squares only, 12 per side.
//  - Men move diagonally forward one square; kings move diagonally either way.
//  - Captures are mandatory when available — a player with any capture on the
//    board may not play a non-capturing move.
//  - A man may capture backward as well as forward (American rule — it's only
//    non-capturing moves that are forward-only). Multi-jump chains are
//    mandatory: a capture must continue from the landing square if a further
//    capture is available from there.
//  - Reaching the far row crowns the piece a king and ends its move
//    immediately, even mid-chain (it does not continue jumping as a king in
//    the same turn).
//  - A player with no legal move (no pieces, or every piece blocked) loses.

export type CheckersColor = 'red' | 'black'
export type Piece = { color: CheckersColor; king: boolean }
export type Cell = Piece | null
export type Board = Cell[][] // board[row][col]; red starts near row 0, black near row 7

export const SIZE = 8

type Coord = [number, number]

export type Move = {
  from: Coord
  to: Coord
  captures: Coord[] // squares whose pieces are removed, in jump order (empty for a simple move)
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if ((row + col) % 2 === 0) continue // only dark squares carry pieces
      if (row < 3) board[row][col] = { color: 'red', king: false }
      else if (row > 4) board[row][col] = { color: 'black', king: false }
    }
  }
  return board
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE
}

function crownRow(color: CheckersColor): number {
  return color === 'red' ? SIZE - 1 : 0
}

const ALL_DIAGONALS: Coord[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

function forwardDiagonals(color: CheckersColor): Coord[] {
  return color === 'red' ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]]
}

function simpleMovesFor(board: Board, r: number, c: number, piece: Piece): Move[] {
  const dirs = piece.king ? ALL_DIAGONALS : forwardDiagonals(piece.color)
  const moves: Move[] = []
  for (const [dr, dc] of dirs) {
    const tr = r + dr
    const tc = c + dc
    if (inBounds(tr, tc) && board[tr][tc] === null) {
      moves.push({ from: [r, c], to: [tr, tc], captures: [] })
    }
  }
  return moves
}

// All maximal capture sequences starting from (r, c). Both men and kings may
// capture in any of the four diagonal directions (the American backward-
// capture rule). Simulates captured pieces as removed while searching so a
// chain can't re-cross a square it already jumped.
function captureSequencesFor(board: Board, r: number, c: number, piece: Piece): Move[] {
  const sequences: Move[] = []

  function dfs(curBoard: Board, curR: number, curC: number, isKing: boolean, captures: Coord[]) {
    let extended = false
    for (const [dr, dc] of ALL_DIAGONALS) {
      const midR = curR + dr
      const midC = curC + dc
      const landR = curR + 2 * dr
      const landC = curC + 2 * dc
      if (!inBounds(landR, landC)) continue
      const midPiece = curBoard[midR]?.[midC]
      if (!midPiece || midPiece.color === piece.color) continue
      if (curBoard[landR][landC] !== null) continue

      extended = true
      const nextBoard = curBoard.map((row) => [...row])
      nextBoard[curR][curC] = null
      nextBoard[midR][midC] = null
      const promotes = !isKing && landR === crownRow(piece.color)
      nextBoard[landR][landC] = { color: piece.color, king: isKing || promotes }
      const nextCaptures = [...captures, [midR, midC] as Coord]

      if (promotes) {
        // Crowning ends the move immediately, even if another jump is sitting there.
        sequences.push({ from: [r, c], to: [landR, landC], captures: nextCaptures })
      } else {
        dfs(nextBoard, landR, landC, isKing, nextCaptures)
      }
    }
    if (!extended && captures.length > 0) {
      sequences.push({ from: [r, c], to: [curR, curC], captures })
    }
  }

  dfs(board, r, c, piece.king, [])
  return sequences
}

/** All legal moves for `color`. Captures are mandatory: if any piece has a
 *  capture available, only capture moves are returned. */
export function legalMoves(board: Board, color: CheckersColor): Move[] {
  const captures: Move[] = []
  const simples: Move[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c]
      if (!piece || piece.color !== color) continue
      captures.push(...captureSequencesFor(board, r, c, piece))
      if (captures.length === 0) simples.push(...simpleMovesFor(board, r, c, piece))
    }
  }
  return captures.length > 0 ? captures : simples
}

/** Applies a move that came from `legalMoves` (or matches one exactly).
 *  Returns a new board; does not mutate the input. */
export function applyMove(board: Board, move: Move, color: CheckersColor): Board {
  const next = board.map((row) => [...row])
  const piece = next[move.from[0]][move.from[1]]
  if (!piece) return next
  next[move.from[0]][move.from[1]] = null
  for (const [cr, cc] of move.captures) next[cr][cc] = null
  const king = piece.king || move.to[0] === crownRow(color)
  next[move.to[0]][move.to[1]] = { color, king }
  return next
}

/** Finds the legal move matching a client-proposed from/to, ignoring any
 *  client-supplied capture list — the server always trusts its own
 *  recomputed capture path, never the caller's. Returns null if illegal
 *  (including "a capture was available and this isn't one"). */
export function findLegalMove(board: Board, color: CheckersColor, from: Coord, to: Coord): Move | null {
  const moves = legalMoves(board, color)
  return moves.find((m) => m.from[0] === from[0] && m.from[1] === from[1]
    && m.to[0] === to[0] && m.to[1] === to[1]) ?? null
}

function countPieces(board: Board, color: CheckersColor): number {
  let n = 0
  for (const row of board) for (const cell of row) if (cell?.color === color) n++
  return n
}

/** Call after applying `justMoved`'s move. Returns the winner if the game is
 *  now over (opponent has no pieces, or no legal move — a blocked player
 *  loses), else null. */
export function determineOutcome(board: Board, justMoved: CheckersColor): CheckersColor | null {
  const opponent = justMoved === 'red' ? 'black' : 'red'
  if (countPieces(board, opponent) === 0) return justMoved
  if (legalMoves(board, opponent).length === 0) return justMoved
  return null
}

// ── Computer opponent ───────────────────────────────────────────────────

export type CheckersDifficulty = 'easy' | 'medium' | 'hard'

const MAN_VALUE = 100
const KING_VALUE = 175

function evaluate(board: Board, maximizer: CheckersColor): number {
  const minimizer = maximizer === 'red' ? 'black' : 'red'
  let score = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c]
      if (!piece) continue
      const base = piece.king ? KING_VALUE : MAN_VALUE
      // Small push toward the far row for uncrowned pieces — rewards
      // advancing toward kinging rather than shuffling on the back rows.
      const advance = piece.king ? 0 : piece.color === 'red' ? r : SIZE - 1 - r
      const value = base + advance * 2
      score += piece.color === maximizer ? value : -value
    }
  }
  return score
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizer: CheckersColor,
  toMove: CheckersColor,
): number {
  const moves = legalMoves(board, toMove)
  if (moves.length === 0) {
    // toMove is stuck — the other side just won.
    return toMove === maximizer ? -100000 : 100000
  }
  if (depth === 0) return evaluate(board, maximizer)

  const maximizing = toMove === maximizer
  const next = toMove === 'red' ? 'black' : 'red'
  let best = maximizing ? -Infinity : Infinity

  for (const move of moves) {
    const result = applyMove(board, move, toMove)
    const score = minimax(result, depth - 1, alpha, beta, maximizer, next)
    if (maximizing) {
      best = Math.max(best, score)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, score)
      beta = Math.min(beta, best)
    }
    if (beta <= alpha) break
  }
  return best
}

// Depth 4 measured comfortably under half a second even in busy midgame
// positions (mandatory captures prune the branching factor a lot compared
// to chess), so — unlike chess's depth-2 cap — checkers can afford a bit
// more search depth here without risking a frozen-looking browser tab.
const DIFFICULTY: Record<CheckersDifficulty, { depth: number; blunderChance: number }> = {
  easy: { depth: 2, blunderChance: 0.3 },
  medium: { depth: 3, blunderChance: 0.12 },
  hard: { depth: 4, blunderChance: 0 },
}

/** Picks the computer's move for `color` to move. Returns null if `color`
 *  has no legal move (caller should have already stopped play). */
export function pickComputerMove(board: Board, color: CheckersColor, difficulty: CheckersDifficulty): Move | null {
  const moves = legalMoves(board, color)
  if (moves.length === 0) return null

  const { depth, blunderChance } = DIFFICULTY[difficulty]
  if (blunderChance > 0 && Math.random() < blunderChance) {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  const opponent = color === 'red' ? 'black' : 'red'
  const shuffled = [...moves].sort(() => Math.random() - 0.5)
  let bestMove = shuffled[0]
  let bestScore = -Infinity

  for (const move of shuffled) {
    const result = applyMove(board, move, color)
    const score = minimax(result, depth - 1, -Infinity, Infinity, color, opponent)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }
  return bestMove
}
