/**
 * Crossword generator tests. The riskiest failure mode here is a grid that
 * *looks* fine in the data structure but reads wrong on screen — an
 * accidental extra word from two entries running parallel-adjacent, or a
 * clue number that doesn't match where its word actually starts. So the
 * strongest checks reconstruct words directly from the raw grid (the same
 * way a human reading the puzzle would) rather than trusting the placement
 * logic that built it.
 */

import { describe, it, expect } from 'vitest'
import { generateCrossword, type CrosswordPuzzle } from '../lib/games/crossword-generator'
import { CROSSWORD_THEMES, type CrosswordEntry } from '../lib/games/crossword-words'

function entriesEachWordReadsCorrectly(puzzle: CrosswordPuzzle) {
  for (const entry of [...puzzle.across, ...puzzle.down]) {
    let read = ''
    for (let i = 0; i < entry.length; i++) {
      const r = entry.direction === 'down' ? entry.row + i : entry.row
      const c = entry.direction === 'across' ? entry.col + i : entry.col
      const letter = puzzle.grid[r][c]
      expect(letter).not.toBeNull()
      read += letter
    }
    expect(read).toBe(entry.answer)
  }
}

function entriesStartWhereClaimed(puzzle: CrosswordPuzzle) {
  for (const entry of puzzle.across) {
    const before = entry.col === 0 ? null : puzzle.grid[entry.row][entry.col - 1]
    expect(before).toBeNull()
    const after = entry.col + entry.length < puzzle.cols ? puzzle.grid[entry.row][entry.col + entry.length] : null
    expect(after).toBeNull()
  }
  for (const entry of puzzle.down) {
    const before = entry.row === 0 ? null : puzzle.grid[entry.row - 1][entry.col]
    expect(before).toBeNull()
    const after = entry.row + entry.length < puzzle.rows ? puzzle.grid[entry.row + entry.length][entry.col] : null
    expect(after).toBeNull()
  }
}

// Independently reconstructs every horizontal/vertical run of length >= 2
// directly from the grid (no reuse of placement logic) and checks it
// matches exactly one declared entry — this is what catches an accidental
// extra word from two entries running side by side without a real crossing.
function reconstructedRunsMatchDeclaredEntries(puzzle: CrosswordPuzzle) {
  const declaredAcross = new Set(puzzle.across.map((e) => `${e.row},${e.col},${e.length}`))
  const declaredDown = new Set(puzzle.down.map((e) => `${e.row},${e.col},${e.length}`))

  for (let r = 0; r < puzzle.rows; r++) {
    let runStart = -1
    for (let c = 0; c <= puzzle.cols; c++) {
      const filled = c < puzzle.cols && puzzle.grid[r][c] !== null
      if (filled && runStart === -1) runStart = c
      if (!filled && runStart !== -1) {
        const length = c - runStart
        if (length >= 2) expect(declaredAcross.has(`${r},${runStart},${length}`)).toBe(true)
        runStart = -1
      }
    }
  }
  for (let c = 0; c < puzzle.cols; c++) {
    let runStart = -1
    for (let r = 0; r <= puzzle.rows; r++) {
      const filled = r < puzzle.rows && puzzle.grid[r][c] !== null
      if (filled && runStart === -1) runStart = r
      if (!filled && runStart !== -1) {
        const length = r - runStart
        if (length >= 2) expect(declaredDown.has(`${runStart},${c},${length}`)).toBe(true)
        runStart = -1
      }
    }
  }
}

function numbersAreUniqueAndMatchStartCells(puzzle: CrosswordPuzzle) {
  const seen = new Map<number, { row: number; col: number }>()
  for (const entry of [...puzzle.across, ...puzzle.down]) {
    const prior = seen.get(entry.number)
    if (prior) {
      // The same number may legitimately appear once for across and once
      // for down, but only if they share the same start cell.
      expect(prior).toEqual({ row: entry.row, col: entry.col })
    } else {
      seen.set(entry.number, { row: entry.row, col: entry.col })
    }
  }
}

function assertWellFormed(puzzle: CrosswordPuzzle, maxSpan: number) {
  expect(puzzle.across.length + puzzle.down.length).toBeGreaterThan(0)
  expect(puzzle.rows).toBeLessThanOrEqual(maxSpan * 2 + 1)
  expect(puzzle.cols).toBeLessThanOrEqual(maxSpan * 2 + 1)
  entriesEachWordReadsCorrectly(puzzle)
  entriesStartWhereClaimed(puzzle)
  reconstructedRunsMatchDeclaredEntries(puzzle)
  numbersAreUniqueAndMatchStartCells(puzzle)
}

const SAMPLE_BANK: CrosswordEntry[] = [
  { word: 'CAT', clue: 'Purrs' },
  { word: 'CAR', clue: 'Drives' },
  { word: 'ART', clue: 'Painting' },
  { word: 'RAT', clue: 'Squeaks' },
  { word: 'STAR', clue: 'Twinkles' },
  { word: 'CARD', clue: 'Playing one' },
  { word: 'TREE', clue: 'Grows leaves' },
  { word: 'READ', clue: 'Books, do this' },
]

describe('generateCrossword — structural correctness', () => {
  it('produces a well-formed puzzle across many runs of a small bank', () => {
    for (let i = 0; i < 25; i++) {
      const puzzle = generateCrossword(SAMPLE_BANK, { maxWords: 6, maxSpan: 6 })
      assertWellFormed(puzzle, 6)
    }
  })

  it('always places at least the first (longest) word', () => {
    const puzzle = generateCrossword([{ word: 'ALONE', clue: 'By yourself' }])
    expect(puzzle.across.length + puzzle.down.length).toBe(1)
    assertWellFormed(puzzle, 6)
  })

  it('never places the same word twice', () => {
    for (let i = 0; i < 10; i++) {
      const puzzle = generateCrossword(SAMPLE_BANK, { maxWords: 8, maxSpan: 6 })
      const answers = [...puzzle.across, ...puzzle.down].map((e) => e.answer)
      expect(new Set(answers).size).toBe(answers.length)
    }
  })

  it('respects maxWords as an upper bound', () => {
    const puzzle = generateCrossword(SAMPLE_BANK, { maxWords: 3, maxSpan: 6 })
    expect(puzzle.across.length + puzzle.down.length).toBeLessThanOrEqual(3)
  })

  it('drops words shorter than 3 letters and words too long for the span', () => {
    const bank: CrosswordEntry[] = [
      { word: 'GO', clue: 'too short' },
      { word: 'CAT', clue: 'fine' },
      { word: 'SUPERCALIFRAGILISTIC', clue: 'way too long' },
    ]
    const puzzle = generateCrossword(bank, { maxWords: 5, maxSpan: 6 })
    const answers = [...puzzle.across, ...puzzle.down].map((e) => e.answer)
    expect(answers).toContain('CAT')
    expect(answers).not.toContain('GO')
    expect(answers).not.toContain('SUPERCALIFRAGILISTIC')
  })
})

describe('generateCrossword — real Downtime word banks', () => {
  for (const theme of CROSSWORD_THEMES) {
    it(`"${theme.label}" reliably builds a solid multi-word puzzle`, () => {
      for (let i = 0; i < 20; i++) {
        const puzzle = generateCrossword(theme.entries, { maxWords: 9, maxSpan: 6 })
        assertWellFormed(puzzle, 6)
        // A puzzle with only 1-2 words isn't much of a crossword — this is
        // the real quality bar, not just "the algorithm didn't crash".
        expect(puzzle.across.length + puzzle.down.length).toBeGreaterThanOrEqual(4)
      }
    })
  }
})
