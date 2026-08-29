'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import {
  generateCrossword, CROSSWORD_DIFFICULTY,
  type CrosswordPuzzle, type PlacedWord, type CrosswordDifficulty,
} from '@/lib/games/crossword-generator'
import { CROSSWORD_THEMES, type CrosswordTheme } from '@/lib/games/crossword-words'
import type { GameResultInput } from '@/lib/games/results'
import { useGameResult, GameResultNote } from '@/components/games/GameResultNote'
import { RefreshCw, Eye, Check, X as Backspace } from '@/components/ui/icons'
import {
  GameShell, GameColumns, GameBackLink, GameToolbar, GameMenu, GameCrest, GameEndCard,
  menuHeadingLevel,
} from '@/components/games/GameChrome'

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const

// Same three levels, same labels, as Chess, Checkers and Connect 4 — a child
// moving between games meets the same choice each time. What each level means
// here lives in CROSSWORD_DIFFICULTY (lib/games/crossword-generator.ts).
const DIFFICULTIES: { id: CrosswordDifficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'A small grid with short words' },
  { id: 'medium', label: 'Medium', blurb: 'The classic puzzle' },
  { id: 'hard', label: 'Hard', blurb: 'A bigger grid, longer words' },
]

const DIFFICULTY_LABEL: Record<CrosswordDifficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard',
}

type Coord = { row: number; col: number }
type Direction = 'across' | 'down'

/** Crossword — pick a theme and a difficulty, and a fresh puzzle is generated
 *  on the spot (see lib/games/crossword-generator.ts). Solo, no timer, no
 *  points — reveal is always one tap away since Downtime is meant to be
 *  pressure-free. */
export function CrosswordGame({
  backHref = '/downtime',
  intro,
}: {
  backHref?: string
  /** The public page's heading block. Used on the two choosing screens, where
   *  it becomes the left column beside the choices. A crossword has no board
   *  to show until a puzzle has been generated, so there is no middle column
   *  here — see GameColumns. */
  intro?: ReactNode
}) {
  const [theme, setTheme] = useState<CrosswordTheme | null>(null)
  const [difficulty, setDifficulty] = useState<CrosswordDifficulty | null>(null)
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null)
  const [entries, setEntries] = useState<string[][]>([])
  const [selected, setSelected] = useState<Coord | null>(null)
  const [direction, setDirection] = useState<Direction>('across')
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)

  function startPuzzle(t: CrosswordTheme, d: CrosswordDifficulty) {
    const p = generateCrossword(t.entries, CROSSWORD_DIFFICULTY[d])
    setTheme(t)
    setDifficulty(d)
    setPuzzle(p)
    setEntries(Array.from({ length: p.rows }, () => Array(p.cols).fill('')))
    setDirection('across')
    setSelected(p.across[0] ? { row: p.across[0].row, col: p.across[0].col } : { row: p.down[0].row, col: p.down[0].col })
    setWrongCells(new Set())
    setSolved(false)
    setRevealed(false)
  }

  function newPuzzle() {
    if (theme && difficulty) startPuzzle(theme, difficulty)
  }

  function exitToThemes() {
    setTheme(null)
    setDifficulty(null)
    setPuzzle(null)
  }

  if (!theme) {
    return (
      <GameColumns
        intro={intro}
        topBar={<GameBackLink href={backHref} />}
        side={
          <GameMenu
            headingLevel={menuHeadingLevel(backHref)}
            crest={<GameCrest tone="paper" glyph="✎" />}
            title="Crossword"
            blurb="Pick a theme. Every puzzle is built fresh, so no two are the same."
            options={CROSSWORD_THEMES.map((t) => ({ id: t.id, label: t.label, glyph: t.emoji }))}
            onPick={(id) => {
              const t = CROSSWORD_THEMES.find((x) => x.id === id)
              if (t) setTheme(t)
            }}
          />
        }
      />
    )
  }

  if (!difficulty || !puzzle) {
    return (
      <GameColumns
        intro={intro}
        topBar={<GameBackLink href={backHref} />}
        side={
          <GameMenu
            headingLevel={menuHeadingLevel(backHref)}
            crest={<GameCrest tone="paper" glyph={theme.emoji} />}
            title={theme.label}
            blurb="How tricky should this one be?"
            options={DIFFICULTIES}
            onPick={(id) => startPuzzle(theme, id as CrosswordDifficulty)}
            footer={
              <button
                onClick={exitToThemes}
                className="mx-auto flex min-h-[48px] items-center justify-center px-4 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
              >
                Pick a different theme
              </button>
            }
          />
        }
      />
    )
  }

  return (
    <PuzzleBoard
      backHref={backHref}
      theme={theme}
      difficulty={difficulty}
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
  backHref, theme, difficulty, puzzle, entries, setEntries, selected, setSelected, direction, setDirection,
  wrongCells, setWrongCells, solved, setSolved, revealed, setRevealed, onNewPuzzle, onExit,
}: {
  backHref: string
  theme: CrosswordTheme
  difficulty: CrosswordDifficulty
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
  // A genuinely solved puzzle goes into the player's game history; tapping
  // Reveal doesn't count as a solve, so it records nothing. Score is the
  // number of words filled in. Guests get the register invitation instead
  // (see GameResultNote).
  const result = useMemo<GameResultInput | null>(() => (
    solved && !revealed
      ? { gameType: 'crossword', mode: 'solo', outcome: 'win', difficulty, score: puzzle.across.length + puzzle.down.length }
      : null
  ), [solved, revealed, difficulty, puzzle])
  const saveStatus = useGameResult(result)

  const activeWord = selected ? findWordAt(puzzle, selected, direction)
    ?? findWordAt(puzzle, selected, direction === 'across' ? 'down' : 'across') : undefined
  const activeCells = useMemo(() => (activeWord ? new Set(cellsOf(activeWord).map((c) => `${c.row},${c.col}`)) : new Set<string>()), [activeWord])

  const filledCount = useMemo(() => {
    let done = 0
    let total = 0
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (puzzle.grid[r][c] === null) continue
        total++
        if (entries[r]?.[c]) done++
      }
    }
    return { done, total }
  }, [entries, puzzle])

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

  // The grid fills the width it is given rather than sitting at a fixed 32px
  // per cell, which used to leave a 5-column puzzle marooned in the middle of
  // the screen and push an 11-column one into a horizontal scroll.
  const cellSize = `clamp(28px, calc((min(100vw, 28rem) - 3rem) / ${puzzle.cols}), 44px)`

  return (
    <GameShell width="md">
      <GameToolbar backHref={backHref} onBack={onExit} onReset={onNewPuzzle} resetLabel="New puzzle" />

      <div className="flex items-baseline justify-between px-1">
        <p className="font-heading font-bold text-ink">
          <span aria-hidden>{theme.emoji}</span> {theme.label}
          <span className="ml-1.5 align-middle rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-ink-2">
            {DIFFICULTY_LABEL[difficulty]}
          </span>
        </p>
        <p className="font-mono text-xs tabular-nums text-ink-2">
          {filledCount.done}/{filledCount.total} letters
        </p>
      </div>

      {/* The puzzle sits on a sheet of paper with a printed border, rather
          than floating as bare cells on the page background. */}
      <div
        className="mx-auto w-fit max-w-full overflow-x-auto rounded-2xl p-3"
        style={{
          background: 'var(--game-paper)',
          boxShadow: 'var(--game-lift), inset 0 0 0 1px rgb(var(--tw-ink) / 0.10)',
        }}
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, ${cellSize})` }}
          role="group"
          aria-label="Crossword grid"
        >
          {Array.from({ length: puzzle.rows }, (_, r) => (
            Array.from({ length: puzzle.cols }, (_, c) => {
              const answer = puzzle.grid[r][c]
              if (answer === null) {
                return <div key={`${r}-${c}`} style={{ width: cellSize, height: cellSize }} aria-hidden />
              }
              const value = entries[r]?.[c] ?? ''
              const isSelected = !!selected && selected.row === r && selected.col === c
              const isActive = activeCells.has(`${r},${c}`)
              const isWrong = wrongCells.has(`${r},${c}`)
              const number = [...puzzle.across, ...puzzle.down].find((w) => w.row === r && w.col === c)?.number
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => selectCell(r, c)}
                  aria-label={`Row ${r + 1}, column ${c + 1}${value ? `, ${value}` : ', empty'}${isWrong ? ', wrong letter' : ''}`}
                  aria-pressed={isSelected}
                  className="relative flex items-center justify-center text-[0.95rem] font-bold uppercase leading-none transition-[background-color] duration-150"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    // Active word gets a warm fig wash (15.4:1 with ink);
                    // the one selected cell gets an ember ring on top of it,
                    // so "the word I'm in" and "the letter I'm on" are told
                    // apart by shape, not two shades of the same blue.
                    background: isActive ? 'var(--game-active-word)' : 'var(--game-paper)',
                    boxShadow: isSelected
                      ? 'inset 0 0 0 3px var(--game-sel-ring), inset 0 0 0 100px var(--game-sel)'
                      : `inset 0 0 0 1px var(--game-paper-rule)`,
                    color: isWrong ? 'var(--game-danger)' : 'rgb(var(--tw-ink))',
                  }}
                >
                  {number && (
                    <span className="absolute left-[3px] top-[1px] text-[9px] font-bold leading-none text-ink-2">
                      {number}
                    </span>
                  )}
                  {value}
                  {/* A wrong letter is struck through as well as recoloured,
                      so it still reads as wrong without colour vision. */}
                  {isWrong && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-[15%]"
                      style={{
                        background:
                          'linear-gradient(to top left, transparent 46%, var(--game-danger) 46%, var(--game-danger) 54%, transparent 54%)',
                      }}
                    />
                  )}
                </button>
              )
            })
          ))}
        </div>
      </div>

      {activeWord && !solved && (
        <button
          onClick={() => setDirection(direction === 'across' ? 'down' : 'across')}
          className="flex w-full items-start gap-2 rounded-xl border border-brand/20 bg-brand/[0.06] px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand/10"
        >
          <span className="shrink-0 rounded-md bg-brand-600 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
            {activeWord.number}
            {activeWord.direction === 'across' ? 'A' : 'D'}
          </span>
          <span className="text-pretty text-ink">{activeWord.clue}</span>
        </button>
      )}

      {!solved && (
        <>
          <OnScreenKeyboard onLetter={typeLetter} onBackspace={backspace} />
          <div className="flex gap-2">
            <button
              onClick={checkAnswers}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-surface font-heading text-sm font-bold text-ink shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/[0.04]"
            >
              <Check className="h-4 w-4" aria-hidden /> Check
            </button>
            <button
              onClick={revealAll}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-black/10 bg-surface px-4 text-sm font-semibold text-ink-2 shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/[0.04]"
            >
              <Eye className="h-4 w-4" aria-hidden /> Reveal
            </button>
          </div>
        </>
      )}

      <ClueLists puzzle={puzzle} activeWord={activeWord} entries={entries} onSelect={selectWord} />

      <AnimatePresence>
        {solved && (
          <GameEndCard
            outcome={revealed ? 'draw' : 'win'}
            title={revealed ? 'Here it is' : 'Puzzle solved!'}
            detail={
              revealed
                ? 'No worries. Have another go with a fresh puzzle.'
                : 'Nicely done, every word filled in.'
            }
            actionLabel="New puzzle"
            onAction={onNewPuzzle}
            secondary={saveStatus ? <GameResultNote status={saveStatus} /> : undefined}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}

/**
 * A QWERTY layout rather than A-to-Z in a 7-wide block. Children who have
 * used any keyboard already know where the letters live; alphabetical order
 * makes them hunt.
 *
 * Keys are 48px tall, meeting the project's tap-target rule on the axis that
 * decides thumb accuracy. Width cannot also be 48px and this is arithmetic,
 * not an oversight: ten keys across a 375px phone leaves ~30px each. Every
 * system keyboard has the same shape for the same reason. The gaps are as
 * tight as they can be without keys visually merging.
 */
function OnScreenKeyboard({ onLetter, onBackspace }: { onLetter: (l: string) => void; onBackspace: () => void }) {
  return (
    <div className="space-y-1.5 rounded-2xl bg-black/[0.04] p-1.5">
      {KEYBOARD_ROWS.map((row, i) => (
        <div key={row} className="flex justify-center gap-1">
          {i === 2 && <span className="w-6 shrink-0" aria-hidden />}
          {row.split('').map((l) => (
            <button
              key={l}
              onClick={() => onLetter(l)}
              className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg bg-surface text-base font-bold text-ink shadow-sm transition-[background-color,transform] duration-100 hover:bg-brand/10 active:scale-95 active:bg-brand/20"
            >
              {l}
            </button>
          ))}
          {i === 2 && (
            <button
              onClick={onBackspace}
              aria-label="Delete letter"
              className="flex min-h-[48px] w-[14%] shrink-0 items-center justify-center rounded-lg bg-surface text-ink-2 shadow-sm transition-[background-color,transform] duration-100 hover:bg-brand/10 active:scale-95"
            >
              <Backspace className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      ))}
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
      <p className="mb-1.5 border-b border-black/10 pb-1 font-heading text-sm font-bold text-ink">{title}</p>
      <ul className="space-y-0.5">
        {words.map((w) => (
          <li key={`${w.direction}-${w.number}`}>
            <button
              onClick={() => onSelect(w)}
              className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                activeWord === w
                  ? 'bg-brand/10 font-semibold text-ink'
                  : isFilled(w)
                    ? 'text-muted line-through decoration-1'
                    : 'text-ink-2 hover:bg-black/5'
              }`}
            >
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums">{w.number}</span>
              <span className="text-pretty">{w.clue}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
