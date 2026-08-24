// Word-tile placement validation and scoring — the part of the game where
// "close enough" isn't good enough, since it's the one place a kid could
// notice the game is cheating them out of points. Every rule below (premium
// squares apply only to newly placed tiles, blanks score 0, every word a
// placement forms — not just the main one — must be a real word, the
// 50-point bonus for using a full rack) is exactly what the official rules
// specify, and each gets its own test.

import { BOARD_SIZE, CENTER, PREMIUM_LAYOUT, letterValue, drawTiles, shuffled } from './scrabble-board'
import { isValidWord } from './scrabble-dictionary'

export type Tile = { letter: string; isBlank: boolean }
export type ScrabbleBoard = (Tile | null)[][]

export function createEmptyScrabbleBoard(): ScrabbleBoard {
  return Array.from({ length: BOARD_SIZE }, () => Array<Tile | null>(BOARD_SIZE).fill(null))
}

export type PlacementTile = { row: number; col: number; letter: string; isBlank: boolean }

export type ScrabbleMove =
  | { type: 'place'; tiles: PlacementTile[] }
  | { type: 'pass' }
  | { type: 'exchange'; tiles: string[] }

export type ApplyResult =
  | {
      ok: true
      board: ScrabbleBoard
      rack: string[]
      bag: string[]
      scoreGained: number
      wordsFormed: string[]
      isBingo: boolean
      scored: boolean // false for pass/exchange
    }
  | { ok: false; error: string }

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}

type WordRun = { word: string; cells: { row: number; col: number }[] }

/** Walks outward from (row, col) in both directions along (dr, dc) through
 *  `merged` (existing board + tentative new tiles) to find the full
 *  contiguous run through that cell. Returns null if the run is a single
 *  letter (not a word). */
function extendWord(merged: ScrabbleBoard, row: number, col: number, dr: number, dc: number): WordRun | null {
  let sr = row
  let sc = col
  while (inBounds(sr - dr, sc - dc) && merged[sr - dr][sc - dc]) {
    sr -= dr
    sc -= dc
  }
  const cells: { row: number; col: number }[] = []
  let word = ''
  let r = sr
  let c = sc
  while (inBounds(r, c) && merged[r][c]) {
    cells.push({ row: r, col: c })
    word += merged[r][c]!.letter
    r += dr
    c += dc
  }
  return word.length >= 2 ? { word, cells } : null
}

function isBoardEmpty(board: ScrabbleBoard): boolean {
  return board.every((row) => row.every((cell) => cell === null))
}

function scoreWord(merged: ScrabbleBoard, run: WordRun, newTileKeys: Set<string>): number {
  let wordScore = 0
  let wordMultiplier = 1
  for (const cell of run.cells) {
    const tile = merged[cell.row][cell.col]!
    const base = tile.isBlank ? 0 : letterValue(tile.letter)
    const isNew = newTileKeys.has(`${cell.row},${cell.col}`)
    if (!isNew) {
      wordScore += base
      continue
    }
    const premium = PREMIUM_LAYOUT[cell.row][cell.col]
    if (premium === 'DL') wordScore += base * 2
    else if (premium === 'TL') wordScore += base * 3
    else wordScore += base
    if (premium === 'DW') wordMultiplier *= 2
    else if (premium === 'TW') wordMultiplier *= 3
  }
  return wordScore * wordMultiplier
}

/** Exported for the computer opponent (lib/games/scrabble-ai.ts), which
 *  scores every candidate placement through the exact same rules a human
 *  move is held to. */
export function validateAndScorePlacement(
  board: ScrabbleBoard,
  placements: PlacementTile[],
): { ok: true; words: WordRun[]; score: number } | { ok: false; error: string } {
  if (placements.length === 0) return { ok: false, error: 'no_tiles' }

  const seen = new Set<string>()
  for (const t of placements) {
    if (!inBounds(t.row, t.col)) return { ok: false, error: 'out_of_bounds' }
    if (board[t.row][t.col]) return { ok: false, error: 'cell_occupied' }
    const k = `${t.row},${t.col}`
    if (seen.has(k)) return { ok: false, error: 'duplicate_cell' }
    seen.add(k)
    if (!/^[A-Z]$/.test(t.letter)) return { ok: false, error: 'invalid_letter' }
  }

  const rows = new Set(placements.map((t) => t.row))
  const cols = new Set(placements.map((t) => t.col))
  let direction: 'across' | 'down' | null = null
  if (placements.length > 1) {
    if (rows.size === 1) direction = 'across'
    else if (cols.size === 1) direction = 'down'
    else return { ok: false, error: 'not_in_line' }
  }

  const merged: ScrabbleBoard = board.map((row) => [...row])
  for (const t of placements) merged[t.row][t.col] = { letter: t.letter, isBlank: t.isBlank }

  if (direction === 'across') {
    const row = [...rows][0]
    const minC = Math.min(...placements.map((t) => t.col))
    const maxC = Math.max(...placements.map((t) => t.col))
    for (let c = minC; c <= maxC; c++) if (!merged[row][c]) return { ok: false, error: 'gap_in_word' }
  } else if (direction === 'down') {
    const col = [...cols][0]
    const minR = Math.min(...placements.map((t) => t.row))
    const maxR = Math.max(...placements.map((t) => t.row))
    for (let r = minR; r <= maxR; r++) if (!merged[r][col]) return { ok: false, error: 'gap_in_word' }
  }

  if (isBoardEmpty(board)) {
    if (!placements.some((t) => t.row === CENTER && t.col === CENTER)) return { ok: false, error: 'must_cover_center' }
  } else {
    const touchesExisting = placements.some((t) => (
      (inBounds(t.row - 1, t.col) && board[t.row - 1][t.col])
      || (inBounds(t.row + 1, t.col) && board[t.row + 1][t.col])
      || (inBounds(t.row, t.col - 1) && board[t.row][t.col - 1])
      || (inBounds(t.row, t.col + 1) && board[t.row][t.col + 1])
    ))
    if (!touchesExisting) return { ok: false, error: 'not_connected' }
  }

  const words: WordRun[] = []
  if (placements.length === 1) {
    const t = placements[0]
    const across = extendWord(merged, t.row, t.col, 0, 1)
    const down = extendWord(merged, t.row, t.col, 1, 0)
    if (across) words.push(across)
    if (down) words.push(down)
    if (words.length === 0) return { ok: false, error: 'no_word_formed' }
  } else {
    const [dr, dc] = direction === 'across' ? [0, 1] : [1, 0]
    const main = extendWord(merged, placements[0].row, placements[0].col, dr, dc)
    if (main) words.push(main)
    const [pdr, pdc] = direction === 'across' ? [1, 0] : [0, 1]
    for (const t of placements) {
      const cross = extendWord(merged, t.row, t.col, pdr, pdc)
      if (cross) words.push(cross)
    }
  }

  for (const w of words) {
    if (!isValidWord(w.word)) return { ok: false, error: `invalid_word:${w.word}` }
  }

  const newTileKeys = new Set(placements.map((t) => `${t.row},${t.col}`))
  const score = words.reduce((sum, w) => sum + scoreWord(merged, w, newTileKeys), 0)
    + (placements.length === 7 ? 50 : 0) // bingo — used the whole rack in one turn

  return { ok: true, words, score }
}

/** Removes each of `symbols` from `rack` (a copy), one instance per entry.
 *  Returns null if the rack doesn't actually hold everything requested —
 *  the server never trusts a client's claimed rack contents. */
function takeFromRack(rack: string[], symbols: string[]): string[] | null {
  const copy = [...rack]
  for (const symbol of symbols) {
    const idx = copy.indexOf(symbol)
    if (idx === -1) return null
    copy.splice(idx, 1)
  }
  return copy
}

/** Applies one player's move against their own board/rack/bag. Turn
 *  advancement, scoring totals, and end-of-game detection are the caller's
 *  responsibility (this mirrors the split in lib/downtime/move-engine.ts —
 *  this function validates and mutates one player's state, the API route
 *  glues that into the shared game record). */
export function applyScrabbleMove(board: ScrabbleBoard, rack: string[], bag: string[], move: ScrabbleMove): ApplyResult {
  if (move.type === 'pass') {
    return { ok: true, board, rack, bag, scoreGained: 0, wordsFormed: [], isBingo: false, scored: false }
  }

  if (move.type === 'exchange') {
    if (move.tiles.length === 0) return { ok: false, error: 'no_tiles' }
    if (bag.length < 7) return { ok: false, error: 'bag_too_low_to_exchange' }
    const rackAfterTake = takeFromRack(rack, move.tiles)
    if (!rackAfterTake) return { ok: false, error: 'tile_not_in_rack' }
    const bagCopy = [...bag]
    const drawn = drawTiles(bagCopy, move.tiles.length)
    const newBag = shuffled([...bagCopy, ...move.tiles])
    return {
      ok: true, board, rack: [...rackAfterTake, ...drawn], bag: newBag,
      scoreGained: 0, wordsFormed: [], isBingo: false, scored: false,
    }
  }

  // place
  if (move.tiles.length > rack.length) return { ok: false, error: 'not_enough_tiles' }
  const rackAfterTake = takeFromRack(rack, move.tiles.map((t) => (t.isBlank ? '_' : t.letter)))
  if (!rackAfterTake) return { ok: false, error: 'tile_not_in_rack' }

  const result = validateAndScorePlacement(board, move.tiles)
  if (!result.ok) return result

  const newBoard = board.map((row) => [...row])
  for (const t of move.tiles) newBoard[t.row][t.col] = { letter: t.letter, isBlank: t.isBlank }

  const bagCopy = [...bag]
  const drawn = drawTiles(bagCopy, 7 - rackAfterTake.length)

  return {
    ok: true,
    board: newBoard,
    rack: [...rackAfterTake, ...drawn],
    bag: bagCopy,
    scoreGained: result.score,
    wordsFormed: result.words.map((w) => w.word),
    isBingo: move.tiles.length === 7,
    scored: true,
  }
}
