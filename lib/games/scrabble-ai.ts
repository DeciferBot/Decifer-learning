// The Word Tiles computer opponent. Server-only — it reads the full
// dictionary (lib/games/scrabble-dictionary.ts), which never ships to the
// client, so the move generation lives behind the
// /api/downtime/word-tiles/computer route rather than in the browser the
// way the Chess/Checkers/Connect 4 opponents do.
//
// Every candidate placement is scored by the engine's own
// validateAndScorePlacement, so the computer is held to exactly the rules a
// child's move is: real words only (cross-words included), connected,
// centre star on the opening. Difficulty is therefore honest — Easy is the
// same legal player as Hard, it just prefers short, low-scoring words.
//
// How candidates are found: every empty square next to an existing tile is
// an "anchor" (on an empty board, the centre star). Any legal placement puts
// at least one new tile on an anchor, so trying each dictionary word across
// each anchor at every offset covers the move space. Two prunings keep that
// cheap: a rack-letters multiset check drops words the rack can't spell
// (allowing up to two letters to come from tiles already on the board), and
// a word only counts where it is the complete run — no tile immediately
// before or after it — since the extended run is itself some other
// dictionary word the loop will try in its own right.

import { BOARD_SIZE, CENTER } from './scrabble-board'
import { dictionaryWords } from './scrabble-dictionary'
import {
  validateAndScorePlacement,
  type ScrabbleBoard, type PlacementTile, type ScrabbleMove,
} from './scrabble-engine'

export type ScrabbleDifficulty = 'easy' | 'medium' | 'hard'

/** Longest word each level will even look for. The cap is also the main
 *  perf bound: fewer candidate words, fewer placements to score. */
const MAX_WORD_LEN: Record<ScrabbleDifficulty, number> = { easy: 4, medium: 6, hard: 8 }

/** Hard ceiling on full engine validations per turn, so a pathological
 *  board can't stall the request. Ordinary turns sit far below it. */
const MAX_VALIDATIONS = 4000

export type GeneratedScrabbleMove = { tiles: PlacementTile[]; score: number; words: string[] }

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}

function anchorsFor(board: ScrabbleBoard): { row: number; col: number }[] {
  const anchors: { row: number; col: number }[] = []
  let empty = true
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) { empty = false; continue }
      const nextToTile =
        (inBounds(r - 1, c) && board[r - 1][c])
        || (inBounds(r + 1, c) && board[r + 1][c])
        || (inBounds(r, c - 1) && board[r][c - 1])
        || (inBounds(r, c + 1) && board[r][c + 1])
      if (nextToTile) anchors.push({ row: r, col: c })
    }
  }
  return empty ? [{ row: CENTER, col: CENTER }] : anchors
}

/** Cheap over-inclusive filter: can the rack (blanks as wildcards), plus at
 *  most two letters borrowed from tiles already on the board, spell this
 *  word at all? Placement fitting does the exact check afterwards. */
function isCandidate(
  word: string,
  rackCounts: Record<string, number>,
  blanks: number,
  boardLetters: Set<string>,
  boardEmpty: boolean,
): boolean {
  const need: Record<string, number> = {}
  for (const ch of word) need[ch] = (need[ch] ?? 0) + 1
  let blanksLeft = blanks
  let boardBudget = boardEmpty ? 0 : 2
  for (const ch in need) {
    let missing = need[ch] - (rackCounts[ch] ?? 0)
    while (missing > 0) {
      if (boardBudget > 0 && boardLetters.has(ch)) { boardBudget--; missing-- }
      else if (blanksLeft > 0) { blanksLeft--; missing-- }
      else return false
    }
  }
  return true
}

/** Lays `word` from (r0,c0) along (dr,dc): board tiles must match their
 *  letter, empty cells come from the rack (real letters first, blanks for
 *  whatever is missing). Null when it can't be done or nothing new would
 *  be placed. */
function fitWord(
  board: ScrabbleBoard,
  word: string,
  r0: number, c0: number, dr: number, dc: number,
  rackCounts: Record<string, number>,
  blanks: number,
): PlacementTile[] | null {
  const placements: PlacementTile[] = []
  for (let i = 0; i < word.length; i++) {
    const r = r0 + dr * i
    const c = c0 + dc * i
    const existing = board[r][c]
    if (existing) {
      if (existing.letter !== word[i]) return null
      continue
    }
    placements.push({ row: r, col: c, letter: word[i], isBlank: false })
  }
  if (placements.length === 0 || placements.length > 7) return null
  const counts = { ...rackCounts }
  let blanksLeft = blanks
  for (const p of placements) {
    if ((counts[p.letter] ?? 0) > 0) counts[p.letter]--
    else if (blanksLeft > 0) { blanksLeft--; p.isBlank = true }
    else return null
  }
  return placements
}

/** Every legal placement (up to the word-length cap and the validation
 *  ceiling), each scored by the real engine. Exported for tests. */
export function generateScrabbleMoves(
  board: ScrabbleBoard,
  rack: string[],
  maxWordLen: number,
): GeneratedScrabbleMove[] {
  const anchors = anchorsFor(board)
  const boardEmpty = board.every((row) => row.every((cell) => !cell))

  const rackCounts: Record<string, number> = {}
  let blanks = 0
  for (const t of rack) {
    if (t === '_') blanks++
    else rackCounts[t] = (rackCounts[t] ?? 0) + 1
  }
  if (blanks === 0 && Object.keys(rackCounts).length === 0) return []

  const boardLetters = new Set<string>()
  for (const row of board) for (const cell of row) if (cell) boardLetters.add(cell.letter)

  const moves: GeneratedScrabbleMove[] = []
  const tried = new Set<string>()
  let validations = 0

  outer:
  for (const word of dictionaryWords()) {
    if (word.length > maxWordLen) continue
    if (!isCandidate(word, rackCounts, blanks, boardLetters, boardEmpty)) continue
    for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
      for (const anchor of anchors) {
        for (let k = 0; k < word.length; k++) {
          const r0 = anchor.row - dr * k
          const c0 = anchor.col - dc * k
          const r1 = r0 + dr * (word.length - 1)
          const c1 = c0 + dc * (word.length - 1)
          if (!inBounds(r0, c0) || !inBounds(r1, c1)) continue
          const key = `${r0},${c0},${dr},${word}`
          if (tried.has(key)) continue
          tried.add(key)
          // Only count the spot where this word is the whole run — a tile
          // butting up against either end would extend it into a different
          // word, which gets tried under its own dictionary entry.
          if (inBounds(r0 - dr, c0 - dc) && board[r0 - dr][c0 - dc]) continue
          if (inBounds(r1 + dr, c1 + dc) && board[r1 + dr][c1 + dc]) continue
          const placement = fitWord(board, word, r0, c0, dr, dc, rackCounts, blanks)
          if (!placement) continue
          validations++
          const result = validateAndScorePlacement(board, placement)
          if (result.ok) {
            moves.push({ tiles: placement, score: result.score, words: result.words.map((w) => w.word) })
          }
          if (validations >= MAX_VALIDATIONS) break outer
        }
      }
    }
  }
  return moves
}

/**
 * The computer's turn. Hard takes the highest-scoring placement it found;
 * Medium picks from the upper-middle of the score range; Easy picks from
 * the bottom third. With no placement available it swaps its rack when the
 * bag still allows an exchange (the same ≥7-tiles rule the engine enforces
 * on players), otherwise it passes.
 */
export function pickScrabbleMove(
  board: ScrabbleBoard,
  rack: string[],
  bagCount: number,
  difficulty: ScrabbleDifficulty,
): ScrabbleMove {
  const moves = generateScrabbleMoves(board, rack, MAX_WORD_LEN[difficulty])
  if (moves.length > 0) {
    const sorted = [...moves].sort((a, b) => a.score - b.score)
    let index: number
    if (difficulty === 'hard') {
      index = sorted.length - 1
    } else if (difficulty === 'medium') {
      const lo = Math.floor(sorted.length * 0.45)
      const hi = Math.floor(sorted.length * 0.8)
      index = lo + Math.floor(Math.random() * Math.max(1, hi - lo))
    } else {
      index = Math.floor(Math.random() * Math.max(1, Math.floor(sorted.length * 0.35)))
    }
    return { type: 'place', tiles: sorted[Math.min(index, sorted.length - 1)].tiles }
  }

  // Blanks are the best tiles in the bag — never swap those away.
  const returnable = rack.filter((t) => t !== '_')
  if (bagCount >= 7 && returnable.length > 0) return { type: 'exchange', tiles: returnable }
  return { type: 'pass' }
}
