'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { fireFeedback } from '@/lib/feedback'
import { WinBurst } from '@/components/quiz/WinBurst'
import { generateCrossword, type CrosswordPuzzle, type PlacedWord } from '@/lib/games/crossword-generator'
import { CROSSWORD_THEMES, type CrosswordTheme } from '@/lib/games/crossword-words'
import { ChevronLeft, RefreshCw, Trophy, Eye, X as Backspace } from '@/components/ui/icons'

const KEYBOARD_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type Coord = { row: number; col: number }
type Direction = 'across' | 'down'

/** Crossword — pick a theme, a fresh puzzle is generated on the spot (see
 *  lib/games/crossword-generator.ts). Solo, no timer, no points — reveal
 *  is always one tap away since Downtime is meant to be pressure-free. */
export function CrosswordGame({ backHref = '/downtime' }: { backHref?: string }) {
  const [theme, setTheme] = useState<CrosswordTheme | null>(null)
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null)
  const [entries, setEntries] = useState<string[][]>([])
  const [selected, setSelected] = useState<Coord | null>(null)
  const [direction, setDirection] = useState<Direction>('across')
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)

  function startPuzzle(t: CrosswordTheme) {
    const p = generateCrossword(t.entries, { maxWords: 9, maxSpan: 5 })
    setTheme(t)
    setPuzzle(p)
    setEntries(Array.from({ length: p.rows }, () => Array(p.cols).fill('')))
    setDirection('across')
    setSelected(p.across[0] ? { row: p.across[0].row, col: p.across[0].col } : { row: p.down[0].row, col: p.down[0].col })
    setWrongCells(new Set())
    setSolved(false)
    setRevealed(false)
  }

  function newPuzzle() {
    if (theme) startPuzzle(theme)
  }

  function exitToThemes() {
    setTheme(null)
    setPuzzle(null)
  }

  if (!theme || !puzzle) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <BackLink href={backHref} />
        <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
          <p className="mb-4 text-5xl" aria-hidden>📝</p>
          <h1 className="font-heading text-2xl font-bold text-ink">Crossword</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Pick a theme</p>
          <div className="space-y-2">
            {CROSSWORD_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => startPuzzle(t)}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-black/10 bg-background px-4 py-3 text-left transition-colors hover:border-maths hover:bg-maths/5"
              >
                <span className="text-2xl" aria-hidden>{t.emoji}</span>
                <span className="font-heading font-bold text-ink">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <PuzzleBoard
      backHref={backHref}
      theme={theme}
      puzzle={puzzle}
      entries={entries}
      setEntries={setEntries}
      selected={selected}
      setSelected={setSelected}
      direction={direction}
      setDirection={setDirection}
      wrongCells={wrongCells}
      setWrongCells={setWrongCells}
      solved={solved}
      setSolved={setSolved}
      revealed={revealed}
      setRevealed={setRevealed}
      onNewPuzzle={newPuzzle}
      onExit={exitToThemes}
    />
  )
}

function findWordAt(puzzle: CrosswordPuzzle, cell: Coord, direction: Direction): PlacedWord | undefined {
  const list = direction === 'across' ? puzzle.across : puzzle.down
  return list.find((w) => (
    direction === 'across'
      ? w.row === cell.row && cell.col >= w.col && cell.col < w.col + w.length
      : w.col === cell.col && cell.row >= w.row && cell.row < w.row + w.length
  ))
}

function cellsOf(word: PlacedWord): Coord[] {
  return Array.from({ length: word.length }, (_, i) => (
    word.direction === 'across' ? { row: word.row, col: word.col + i } : { row: word.row + i, col: word.col }
  ))
}

function PuzzleBoard({
  backHref, theme, puzzle, entries, setEntries, selected, setSelected, direction, setDirection,
  wrongCells, setWrongCells, solved, setSolved, revealed, setRevealed, onNewPuzzle, onExit,
}: {
  backHref: string
  theme: CrosswordTheme
  puzzle: CrosswordPuzzle
  entries: string[][]
  setEntries: (fn: (prev: string[][]) => string[][]) => void
  selected: Coord | null
  setSelected: (c: Coord | null) => void
  direction: Direction
  setDirection: (d: Direction) => void
  wrongCells: Set<string>
  setWrongCells: (fn: (prev: Set<string>) => Set<string>) => void
  solved: boolean
  setSolved: (v: boolean) => void
  revealed: boolean
  setRevealed: (v: boolean) => void
  onNewPuzzle: () => void
  onExit: () => void
}) {
  const activeWord = selected ? findWordAt(puzzle, selected, direction)
    ?? findWordAt(puzzle, selected, direction === 'across' ? 'down' : 'across') : undefined
  const activeCells = useMemo(() => (activeWord ? new Set(cellsOf(activeWord).map((c) => `${c.row},${c.col}`)) : new Set<string>()), [activeWord])

  function selectCell(row: number, col: number) {
    if (puzzle.grid[row][col] === null) return
    const cell = { row, col }
    const sameCell = selected && selected.row === row && selected.col === col
    const hasAcross = !!findWordAt(puzzle, cell, 'across')
    const hasDown = !!findWordAt(puzzle, cell, 'down')
    let nextDir = direction
    if (sameCell && hasAcross && hasDown) nextDir = direction === 'across' ? 'down' : 'across'
    else if (!findWordAt(puzzle, cell, direction)) nextDir = hasAcross ? 'across' : 'down'
    setSelected(cell)
    setDirection(nextDir)
  }

  function selectWord(word: PlacedWord) {
    setSelected({ row: word.row, col: word.col })
    setDirection(word.direction)
  }

  function checkCompletion(next: string[][]) {
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const answer = puzzle.grid[r][c]
        if (answer === null) continue
        if (next[r][c] !== answer) return
      }
    }
    setSolved(true)
    fireFeedback('roundComplete')
  }

  function advance(from: Coord, dir: Direction, dropWord: boolean) {
    const word = findWordAt(puzzle, from, dir)
    if (!word) return
    const cells = cellsOf(word)
    const idx = cells.findIndex((c) => c.row === from.row && c.col === from.col)
    if (idx < cells.length - 1) {
      setSelected(cells[idx + 1])
      return
    }
    if (!dropWord) return
    // Word finished — jump to the next unfilled word, if any.
    const all = [...puzzle.across, ...puzzle.down]
    const currentIndex = all.findIndex((w) => w === word)
    for (let offset = 1; offset < all.length; offset++) {
      const candidate = all[(currentIndex + offset) % all.length]
      const candidateCells = cellsOf(candidate)
      if (candidateCells.some((c) => entries[c.row][c.col] === '')) {
        setSelected(candidateCells[0])
        setDirection(candidate.direction)
        return
      }
    }
  }

  function typeLetter(letter: string) {
    if (!selected || solved) return
    const { row, col } = selected
    if (puzzle.grid[row][col] === null) return
    setEntries((prev) => {
      const next = prev.map((r) => [...r])
      next[row][col] = letter
      checkCompletion(next)
      return next
    })
    setWrongCells((prev) => {
      if (!prev.has(`${row},${col}`)) return prev
      const next = new Set(prev)
      next.delete(`${row},${col}`)
      return next
    })
    advance(selected, direction, true)
  }

  function backspace() {
    if (!selected) return
    const { row, col } = selected
    if (entries[row][col] !== '') {
      setEntries((prev) => {
        const next = prev.map((r) => [...r])
        next[row][col] = ''
        return next
      })
      return
    }
    const word = findWordAt(puzzle, selected, direction)
    if (!word) return
    const cells = cellsOf(word)
    const idx = cells.findIndex((c) => c.row === row && c.col === col)
    if (idx > 0) {
      const prevCell = cells[idx - 1]
      setSelected(prevCell)
      setEntries((prev) => {
        const next = prev.map((r) => [...r])
        next[prevCell.row][prevCell.col] = ''
        return next
      })
    }
  }

  function checkAnswers() {
    const wrong = new Set<string>()
    let anyWrong = false
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const answer = puzzle.grid[r][c]
        if (answer === null) continue
        const value = entries[r][c]
        if (value !== '' && value !== answer) {
          wrong.add(`${r},${c}`)
          anyWrong = true
        }
      }
    }
    setWrongCells(() => wrong)
    fireFeedback(anyWrong ? 'incorrect' : 'correct')
  }

  function revealAll() {
    setEntries(() => puzzle.grid.map((row) => row.map((cell) => cell ?? '')))
    setWrongCells(() => new Set())
    setRevealed(true)
    setSolved(true)
  }

  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="flex items-center justify-between">
        <BackLink href={backHref} onClick={onExit} />
        <div className="flex items-center gap-2">
          <button
            onClick={onNewPuzzle}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> New puzzle
          </button>
        </div>
      </div>

      <p className="text-center text-sm font-semibold text-muted">{theme.emoji} {theme.label}</p>

      <div className="overflow-x-auto">
        <div className="mx-auto inline-block rounded-xl border border-black/10 bg-surface p-1.5 shadow-sm">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))` }}
            role="group"
            aria-label="Crossword grid"
          >
            {Array.from({ length: puzzle.rows }, (_, r) => (
              Array.from({ length: puzzle.cols }, (_, c) => {
                const answer = puzzle.grid[r][c]
                if (answer === null) return <div key={`${r}-${c}`} className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden />
                const value = entries[r]?.[c] ?? ''
                const isSelected = selected && selected.row === r && selected.col === c
                const isActive = activeCells.has(`${r},${c}`)
                const isWrong = wrongCells.has(`${r},${c}`)
                const number = [...puzzle.across, ...puzzle.down].find((w) => w.row === r && w.col === c)?.number
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => selectCell(r, c)}
                    aria-label={`Row ${r + 1}, column ${c + 1}${value ? `, ${value}` : ''}`}
                    className="relative flex h-8 w-8 items-center justify-center border border-black/10 text-sm font-bold uppercase transition-colors sm:h-9 sm:w-9"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(108,158,255,0.5)'
                        : isActive
                          ? 'rgba(108,158,255,0.18)'
                          : '#FFFFFF',
                      color: isWrong ? '#FF6B6B' : '#2D3748',
                    }}
                  >
                    {number && <span className="absolute left-0.5 top-0 text-[8px] font-semibold text-muted">{number}</span>}
                    {value}
                  </button>
                )
              })
            ))}
          </div>
        </div>
      </div>

      {activeWord && !solved && (
        <button
          onClick={() => setDirection(direction === 'across' ? 'down' : 'across')}
          className="w-full rounded-xl bg-maths/10 px-4 py-2 text-left text-sm"
        >
          <span className="font-bold text-maths">{activeWord.number} {activeWord.direction === 'across' ? 'Across' : 'Down'}</span>
          <span className="ml-2 text-ink-2">{activeWord.clue}</span>
        </button>
      )}

      {!solved && (
        <>
          <OnScreenKeyboard onLetter={typeLetter} onBackspace={backspace} />
          <div className="flex gap-2">
            <button
              onClick={checkAnswers}
              className="flex-1 rounded-xl border-2 border-black/10 bg-background px-4 py-2.5 text-sm font-heading font-bold text-ink transition-colors hover:border-maths"
            >
              Check
            </button>
            <button
              onClick={revealAll}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-black/10 px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-maths"
            >
              <Eye className="h-4 w-4" aria-hidden /> Reveal
            </button>
          </div>
        </>
      )}

      <ClueLists puzzle={puzzle} activeWord={activeWord} entries={entries} onSelect={selectWord} />

      <AnimatePresence>
        {solved && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm"
          >
            {!revealed && <WinBurst />}
            <div className="mb-2 flex justify-center">
              {revealed ? <span className="text-4xl" aria-hidden>👀</span> : <Trophy className="h-10 w-10 text-points-gold" aria-hidden />}
            </div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {revealed ? 'Here it is!' : 'Puzzle solved!'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {revealed ? 'No worries — have another go with a fresh puzzle.' : 'Nicely done — every word filled in.'}
            </p>
            <button
              onClick={onNewPuzzle}
              className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-maths px-6 font-heading font-bold text-white transition-opacity hover:opacity-90"
            >
              New puzzle
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function OnScreenKeyboard({ onLetter, onBackspace }: { onLetter: (l: string) => void; onBackspace: () => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {KEYBOARD_LETTERS.map((l) => (
        <button
          key={l}
          onClick={() => onLetter(l)}
          className="flex min-h-[44px] items-center justify-center rounded-lg bg-background text-sm font-bold text-ink transition-colors hover:bg-maths/10 active:bg-maths/20"
        >
          {l}
        </button>
      ))}
      <button
        onClick={onBackspace}
        aria-label="Backspace"
        className="flex min-h-[44px] items-center justify-center rounded-lg bg-background text-ink-2 transition-colors hover:bg-maths/10 active:bg-maths/20"
      >
        <Backspace className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

function ClueLists({
  puzzle, activeWord, entries, onSelect,
}: {
  puzzle: CrosswordPuzzle
  activeWord: PlacedWord | undefined
  entries: string[][]
  onSelect: (w: PlacedWord) => void
}) {
  function isFilled(w: PlacedWord) {
    return cellsOf(w).every((c) => entries[c.row]?.[c.col])
  }
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <ClueColumn title="Across" words={puzzle.across} activeWord={activeWord} isFilled={isFilled} onSelect={onSelect} />
      <ClueColumn title="Down" words={puzzle.down} activeWord={activeWord} isFilled={isFilled} onSelect={onSelect} />
    </div>
  )
}

function ClueColumn({
  title, words, activeWord, isFilled, onSelect,
}: {
  title: string
  words: PlacedWord[]
  activeWord: PlacedWord | undefined
  isFilled: (w: PlacedWord) => boolean
  onSelect: (w: PlacedWord) => void
}) {
  return (
    <div>
      <p className="mb-1 font-heading text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-1">
        {words.map((w) => (
          <li key={`${w.direction}-${w.number}`}>
            <button
              onClick={() => onSelect(w)}
              className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                activeWord === w ? 'bg-maths/15 font-semibold text-ink' : isFilled(w) ? 'text-muted line-through' : 'text-ink-2 hover:bg-black/5'
              }`}
            >
              <span className="font-bold">{w.number}.</span> {w.clue}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BackLink({ href, onClick }: { href: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden /> Downtime
    </Link>
  )
}
