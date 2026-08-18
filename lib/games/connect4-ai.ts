// Connect 4 rules + a minimax computer opponent. Unlike chess, the whole
// rule set is small enough to hand-write and fully unit-test with
// confidence — no external library needed here.

export type Cell = null | 'red' | 'yellow'
export type Board = Cell[][] // board[row][col], row 0 = bottom, row 5 = top

export const COLS = 7
export const ROWS = 6

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null))
}

/** The row a piece dropped in `col` would land in, or -1 if the column is full. */
export function landingRow(board: Board, col: number): number {
  for (let row = 0; row < ROWS; row++) {
    if (board[row][col] === null) return row
  }
  return -1
}

/** Drops a piece, returning a NEW board (immutable) and the row it landed in.
 *  Returns null if the column is full. */
export function dropPiece(
  board: Board,
  col: number,
  player: 'red' | 'yellow',
): { board: Board; row: number } | null {
  const row = landingRow(board, col)
  if (row === -1) return null
  const next = board.map((r) => [...r])
  next[row][col] = player
  return { board: next, row }
}

export function legalColumns(board: Board): number[] {
  const cols: number[] = []
  for (let c = 0; c < COLS; c++) {
    if (board[ROWS - 1][c] === null) cols.push(c)
  }
  return cols
}

export function isBoardFull(board: Board): boolean {
  return legalColumns(board).length === 0
}

const DIRECTIONS: [number, number][] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal /
  [1, -1], // diagonal \
]

/** Returns the winner, if the four-in-a-row was completed by the piece at
 *  (row, col) specifically — cheap incremental check after a drop. */
export function winnerAt(board: Board, row: number, col: number): 'red' | 'yellow' | null {
  const player = board[row]?.[col]
  if (!player) return null
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1
    for (const sign of [1, -1]) {
      let r = row + dr * sign
      let c = col + dc * sign
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        count++
        r += dr * sign
        c += dc * sign
      }
    }
    if (count >= 4) return player
  }
  return null
}

/** Full-board scan for a winner — used when we don't know the last move
 *  (e.g. scoring a hypothetical position inside the AI search). */
export function findWinner(board: Board): 'red' | 'yellow' | null {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col]) {
        const w = winnerAt(board, row, col)
        if (w) return w
      }
    }
  }
  return null
}

// ── Computer opponent ───────────────────────────────────────────────────

export type Connect4Difficulty = 'easy' | 'medium' | 'hard'

const DEPTH: Record<Connect4Difficulty, number> = { easy: 2, medium: 4, hard: 6 }
const BLUNDER_CHANCE: Record<Connect4Difficulty, number> = { easy: 0.3, medium: 0.1, hard: 0 }

// Centre columns are strategically stronger in Connect 4 (they take part in
// more possible four-in-a-rows) — a standard, well-known heuristic.
const COLUMN_WEIGHT = [1, 2, 3, 4, 3, 2, 1]

function evaluate(board: Board, maximizer: 'red' | 'yellow'): number {
  const minimizer = maximizer === 'red' ? 'yellow' : 'red'
  const winner = findWinner(board)
  if (winner === maximizer) return 1_000_000
  if (winner === minimizer) return -1_000_000

  let score = 0
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = board[row][col]
      if (cell === maximizer) score += COLUMN_WEIGHT[col]
      else if (cell === minimizer) score -= COLUMN_WEIGHT[col]
    }
  }
  // Windows of four are the real signal: count how many open (not blocked
  // by the opponent) four-cell windows each side already has pieces in.
  score += windowScore(board, maximizer) - windowScore(board, minimizer)
  return score
}

function windowScore(board: Board, player: 'red' | 'yellow'): number {
  const opponent = player === 'red' ? 'yellow' : 'red'
  let total = 0
  const windows: Cell[][] = []

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col <= COLS - 4; col++) {
      windows.push([board[row][col], board[row][col + 1], board[row][col + 2], board[row][col + 3]])
    }
  }
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row <= ROWS - 4; row++) {
      windows.push([board[row][col], board[row + 1][col], board[row + 2][col], board[row + 3][col]])
    }
  }
  for (let row = 0; row <= ROWS - 4; row++) {
    for (let col = 0; col <= COLS - 4; col++) {
      windows.push([
        board[row][col], board[row + 1][col + 1], board[row + 2][col + 2], board[row + 3][col + 3],
      ])
      windows.push([
        board[row + 3][col], board[row + 2][col + 1], board[row + 1][col + 2], board[row][col + 3],
      ])
    }
  }

  for (const w of windows) {
    const mine = w.filter((c) => c === player).length
    const theirs = w.filter((c) => c === opponent).length
    if (theirs > 0) continue // blocked window, no value either way
    if (mine === 3) total += 20
    else if (mine === 2) total += 4
  }
  return total
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizer: 'red' | 'yellow',
  toMove: 'red' | 'yellow',
): number {
  const winner = findWinner(board)
  if (winner) return evaluate(board, maximizer)
  const cols = legalColumns(board)
  if (depth === 0 || cols.length === 0) return evaluate(board, maximizer)

  const maximizing = toMove === maximizer
  const next = toMove === 'red' ? 'yellow' : 'red'
  let best = maximizing ? -Infinity : Infinity

  for (const col of cols) {
    const result = dropPiece(board, col, toMove)
    if (!result) continue
    const score = minimax(result.board, depth - 1, alpha, beta, maximizer, next)
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

/** Picks the computer's column. `computer` is which colour the AI is
 *  playing. Returns null if the board is full (caller should have already
 *  stopped play). */
export function pickComputerColumn(
  board: Board,
  computer: 'red' | 'yellow',
  difficulty: Connect4Difficulty,
): number | null {
  const cols = legalColumns(board)
  if (cols.length === 0) return null

  if (Math.random() < BLUNDER_CHANCE[difficulty]) {
    return cols[Math.floor(Math.random() * cols.length)]
  }

  const depth = DEPTH[difficulty]
  const opponent = computer === 'red' ? 'yellow' : 'red'
  let bestCol = cols[0]
  let bestScore = -Infinity

  // Centre-out order helps alpha-beta prune more (centre moves tend to be
  // stronger, so scoring them first tightens the window faster).
  const ordered = [...cols].sort(
    (a, b) => Math.abs(a - 3) - Math.abs(b - 3),
  )

  for (const col of ordered) {
    const result = dropPiece(board, col, computer)
    if (!result) continue
    const score = minimax(result.board, depth - 1, -Infinity, Infinity, computer, opponent)
    if (score > bestScore) {
      bestScore = score
      bestCol = col
    }
  }
  return bestCol
}
