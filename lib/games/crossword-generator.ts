// A small crossword-construction algorithm: given a themed word bank, places
// as many words as it can into a grid so that every crossing is a genuine
// letter match, no word runs directly alongside another without a proper
// intersection, and no word abuts another end-to-end. This is the same set
// of rules real crossword generators use — get any one of them wrong and
// the puzzle reads as broken the moment a child looks at it, so each rule
// gets its own test rather than trusting the algorithm by inspection.
//
// Construction happens on a generous virtual grid (words placed with
// possibly-negative coordinates), then trimmed to the actual bounding box
// of placed letters and remapped to start at (0, 0).

import type { CrosswordEntry } from './crossword-words'

export type Direction = 'across' | 'down'

export type PlacedWord = {
  number: number
  clue: string
  answer: string
  row: number
  col: number
  direction: Direction
  length: number
}

export type CrosswordPuzzle = {
  rows: number
  cols: number
  grid: (string | null)[][] // solution letters; null = unused/black cell
  across: PlacedWord[]
  down: PlacedWord[]
}

type Cell = { letter: string; across: boolean; down: boolean }

const VIRTUAL_SIZE = 31
const ORIGIN = 15 // centre of the virtual grid

function normaliseWord(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '')
}

function key(r: number, c: number): string {
  return `${r},${c}`
}

function inVirtualBounds(r: number, c: number): boolean {
  return r >= 0 && r < VIRTUAL_SIZE && c >= 0 && c < VIRTUAL_SIZE
}

type Candidate = { word: string; clue: string }

type PlacedInternal = { word: string; clue: string; row: number; col: number; direction: Direction }

function tryPlacement(
  cells: Map<string, Cell>,
  word: string,
  row: number,
  col: number,
  direction: Direction,
  maxSpan: number,
): boolean {
  const dr = direction === 'down' ? 1 : 0
  const dc = direction === 'across' ? 1 : 0

  // The cell immediately before the start and immediately after the end
  // must be empty, or the new word would run straight into another word's
  // letter and read as one merged (wrong) word.
  const beforeR = row - dr
  const beforeC = col - dc
  const afterR = row + dr * word.length
  const afterC = col + dc * word.length
  if (inVirtualBounds(beforeR, beforeC) && cells.has(key(beforeR, beforeC))) return false
  if (inVirtualBounds(afterR, afterC) && cells.has(key(afterR, afterC))) return false

  let hasCrossing = false

  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    if (!inVirtualBounds(r, c)) return false
    // Keep the whole puzzle inside a mobile-friendly bounding box, measured
    // from the centre — enforced per-cell so a single long word can't blow
    // the grid out past what a 375px screen can show.
    if (Math.abs(r - ORIGIN) > maxSpan || Math.abs(c - ORIGIN) > maxSpan) return false

    const existing = cells.get(key(r, c))
    if (existing) {
      if (existing.letter !== word[i]) return false
      if (direction === 'across' && existing.across) return false
      if (direction === 'down' && existing.down) return false
      hasCrossing = true
    } else {
      // A fresh cell: its perpendicular neighbours must be empty, or this
      // word would run directly alongside an existing word without a real
      // intersection (an "orphan" adjacency that reads as an accidental
      // extra word in the finished grid).
      if (direction === 'across') {
        if (cells.has(key(r - 1, c)) || cells.has(key(r + 1, c))) return false
      } else {
        if (cells.has(key(r, c - 1)) || cells.has(key(r, c + 1))) return false
      }
    }
  }

  return hasCrossing
}

function commitPlacement(cells: Map<string, Cell>, word: string, row: number, col: number, direction: Direction) {
  const dr = direction === 'down' ? 1 : 0
  const dc = direction === 'across' ? 1 : 0
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    const existing = cells.get(key(r, c))
    if (existing) {
      cells.set(key(r, c), { letter: word[i], across: existing.across || direction === 'across', down: existing.down || direction === 'down' })
    } else {
      cells.set(key(r, c), { letter: word[i], across: direction === 'across', down: direction === 'down' })
    }
  }
}

function findPlacements(
  cells: Map<string, Cell>,
  word: string,
  maxSpan: number,
): { row: number; col: number; direction: Direction }[] {
  const found: { row: number; col: number; direction: Direction }[] = []
  for (const [k, cell] of cells) {
    const [er, ec] = k.split(',').map(Number)
    for (let i = 0; i < word.length; i++) {
      if (cell.letter !== word[i]) continue
      // Crossing here means the new word runs in the OPPOSITE direction to
      // whichever direction(s) are unoccupied at this cell.
      if (!cell.down) {
        const row = er - i
        const col = ec
        if (tryPlacement(cells, word, row, col, 'down', maxSpan)) found.push({ row, col, direction: 'down' })
      }
      if (!cell.across) {
        const row = er
        const col = ec - i
        if (tryPlacement(cells, word, row, col, 'across', maxSpan)) found.push({ row, col, direction: 'across' })
      }
    }
  }
  return found
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Places as many entries as it can (up to `maxWords`) into a grid, largest
 *  words first. Always succeeds with at least the first word placed — an
 *  empty or too-small bank is a caller error, not something this recovers
 *  from gracefully, since Downtime's word banks are fixed and known good. */
export function generateCrossword(
  bank: CrosswordEntry[],
  opts: { maxWords?: number; maxSpan?: number } = {},
): CrosswordPuzzle {
  const maxWords = opts.maxWords ?? 9
  const maxSpan = opts.maxSpan ?? 6 // keeps the grid to at most 13x13

  const candidates: Candidate[] = bank
    .map((e) => ({ word: normaliseWord(e.word), clue: e.clue }))
    .filter((e) => e.word.length >= 3 && e.word.length <= maxSpan * 2 + 1)

  const byLength = shuffled(candidates).sort((a, b) => b.word.length - a.word.length)
  if (byLength.length === 0) throw new Error('generateCrossword: no usable words in bank')

  const cells = new Map<string, Cell>()
  const placed: PlacedInternal[] = []

  const first = byLength[0]
  const firstCol = ORIGIN - Math.floor(first.word.length / 2)
  commitPlacement(cells, first.word, ORIGIN, firstCol, 'across')
  placed.push({ word: first.word, clue: first.clue, row: ORIGIN, col: firstCol, direction: 'across' })

  for (const candidate of byLength.slice(1)) {
    if (placed.length >= maxWords) break
    if (placed.some((p) => p.word === candidate.word)) continue // no duplicate words in one puzzle
    const options = findPlacements(cells, candidate.word, maxSpan)
    if (options.length === 0) continue
    const choice = options[Math.floor(Math.random() * options.length)]
    commitPlacement(cells, candidate.word, choice.row, choice.col, choice.direction)
    placed.push({ word: candidate.word, clue: candidate.clue, row: choice.row, col: choice.col, direction: choice.direction })
  }

  return buildPuzzle(placed)
}

function buildPuzzle(placed: PlacedInternal[]): CrosswordPuzzle {
  let minR = Infinity
  let maxR = -Infinity
  let minC = Infinity
  let maxC = -Infinity
  for (const p of placed) {
    const dr = p.direction === 'down' ? 1 : 0
    const dc = p.direction === 'across' ? 1 : 0
    const endR = p.row + dr * (p.word.length - 1)
    const endC = p.col + dc * (p.word.length - 1)
    minR = Math.min(minR, p.row, endR)
    maxR = Math.max(maxR, p.row, endR)
    minC = Math.min(minC, p.col, endC)
    maxC = Math.max(maxC, p.col, endC)
  }

  const rows = maxR - minR + 1
  const cols = maxC - minC + 1
  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null))
  for (const p of placed) {
    const dr = p.direction === 'down' ? 1 : 0
    const dc = p.direction === 'across' ? 1 : 0
    for (let i = 0; i < p.word.length; i++) {
      grid[p.row - minR + dr * i][p.col - minC + dc * i] = p.word[i]
    }
  }

  // Standard crossword numbering: scan row-major; a cell is numbered if it
  // starts an across run of >=2 and/or a down run of >=2. Both entries at a
  // shared start cell get the same number.
  const numberAt = new Map<string, number>()
  let next = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) continue
      const startsAcross = grid[r][c - 1] === undefined || c === 0 || grid[r][c - 1] === null
      const hasAcrossRun = startsAcross && c + 1 < cols && grid[r][c + 1] !== null
      const startsDown = r === 0 || grid[r - 1][c] === null
      const hasDownRun = startsDown && r + 1 < rows && grid[r + 1][c] !== null
      if (hasAcrossRun || hasDownRun) {
        numberAt.set(key(r, c), next)
        next++
      }
    }
  }

  const across: PlacedWord[] = []
  const down: PlacedWord[] = []
  for (const p of placed) {
    const row = p.row - minR
    const col = p.col - minC
    const number = numberAt.get(key(row, col))
    if (number === undefined) continue // shouldn't happen — every placed word's start is a numbered cell
    const entry: PlacedWord = { number, clue: p.clue, answer: p.word, row, col, direction: p.direction, length: p.word.length }
    if (p.direction === 'across') across.push(entry)
    else down.push(entry)
  }
  across.sort((a, b) => a.number - b.number)
  down.sort((a, b) => a.number - b.number)

  return { rows, cols, grid, across, down }
}
