// The standard 15x15 word-tile board layout and tile set. These are public
// game facts (the premium-square layout and letter distribution are
// standard, widely published game mechanics, not anyone's copyrighted
// content — the same category as chess's board or checkers' rules), built
// once here rather than re-derived by hand every time it's needed.
//
// The premium layout is built from just the top-left 8x8 octant (rows/cols
// 0-7) and mirrored across both the horizontal and vertical centre lines —
// hand-transcribing all 61 premium squares directly would be exactly the
// kind of error a human proofreading it by eye could miss. The resulting
// counts are checked in __tests__/scrabble-board.test.ts against the
// well-known published totals (8 triple-word, 17 double-word including
// the centre star, 12 triple-letter, 24 double-letter).

export const BOARD_SIZE = 15
export const CENTER = 7

export type Premium = 'TW' | 'DW' | 'TL' | 'DL' | null

// Top-left octant only (rows 0-7, cols 0-7) — mirrored below to fill the
// whole board.
const OCTANT: [number, number, Premium][] = [
  [0, 0, 'TW'], [0, 7, 'TW'], [7, 0, 'TW'],
  [1, 1, 'DW'], [2, 2, 'DW'], [3, 3, 'DW'], [4, 4, 'DW'], [7, 7, 'DW'], // 7,7 is the centre star
  [1, 5, 'TL'], [5, 1, 'TL'], [5, 5, 'TL'],
  [0, 3, 'DL'], [2, 6, 'DL'], [3, 0, 'DL'], [3, 7, 'DL'], [6, 2, 'DL'], [6, 6, 'DL'], [7, 3, 'DL'],
]

function buildPremiumLayout(): Premium[][] {
  const grid: Premium[][] = Array.from({ length: BOARD_SIZE }, () => Array<Premium>(BOARD_SIZE).fill(null))
  for (const [r, c, type] of OCTANT) {
    const mirroredRows = r === CENTER ? [r] : [r, BOARD_SIZE - 1 - r]
    const mirroredCols = c === CENTER ? [c] : [c, BOARD_SIZE - 1 - c]
    for (const mr of mirroredRows) {
      for (const mc of mirroredCols) {
        grid[mr][mc] = type
      }
    }
  }
  return grid
}

export const PREMIUM_LAYOUT: Premium[][] = buildPremiumLayout()

// Standard English tile distribution — 100 tiles, '_' represents a blank.
export const TILE_DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
  _: 2,
}

export const LETTER_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
  _: 0,
}

export function letterValue(letter: string): number {
  return LETTER_VALUES[letter.toUpperCase()] ?? 0
}

/** Fisher-Yates shuffle, returning a new array. */
export function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** A freshly shuffled 100-tile bag, ready to draw from the end. */
export function createTileBag(): string[] {
  const bag: string[] = []
  for (const [letter, count] of Object.entries(TILE_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) bag.push(letter)
  }
  return shuffled(bag)
}

/** Draws up to `count` tiles from the end of `bag`, mutating it in place,
 *  and returns the drawn tiles. Draws fewer if the bag runs out. */
export function drawTiles(bag: string[], count: number): string[] {
  const drawn: string[] = []
  for (let i = 0; i < count && bag.length > 0; i++) {
    drawn.push(bag.pop() as string)
  }
  return drawn
}
