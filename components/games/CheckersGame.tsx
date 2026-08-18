'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { fireFeedback } from '@/lib/feedback'
import { WinBurst } from '@/components/quiz/WinBurst'
import {
  createInitialBoard, legalMoves, applyMove, determineOutcome, pickComputerMove,
  type Board, type CheckersDifficulty,
} from '@/lib/games/checkers-ai'
import { ChevronLeft, RefreshCw, Trophy, Crown } from '@/components/ui/icons'

const DIFFICULTIES: { id: CheckersDifficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Good for a first game' },
  { id: 'medium', label: 'Medium', blurb: 'Plays sensibly, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Never misses a forced capture' },
]

type Coord = [number, number]
type EndState = 'win' | 'loss' | null

/** Checkers against the computer. The child always plays Red and moves
 *  first, from the bottom of the board upward. Captures are mandatory, per
 *  standard American rules — see lib/games/checkers-ai.ts. */
export function CheckersGame({ backHref = '/downtime' }: { backHref?: string }) {
  const [difficulty, setDifficulty] = useState<CheckersDifficulty | null>(null)
  const [board, setBoard] = useState<Board>(() => createInitialBoard())
  const [selected, setSelected] = useState<Coord | null>(null)
  const [thinking, setThinking] = useState(false)
  const [end, setEnd] = useState<EndState>(null)
  const [lastMove, setLastMove] = useState<{ from: Coord; to: Coord } | null>(null)

  const redMoves = legalMoves(board, 'red')
  const movableFrom = new Set(redMoves.map((m) => m.from.join(',')))
  const mustCapture = redMoves.length > 0 && redMoves[0].captures.length > 0
  const targets = selected
    ? redMoves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : []

  const finishIfOver = useCallback((b: Board, mover: 'red' | 'black') => {
    const winner = determineOutcome(b, mover)
    if (winner) {
      setEnd(winner === 'red' ? 'win' : 'loss')
      fireFeedback(winner === 'red' ? 'roundComplete' : 'incorrect')
      return true
    }
    return false
  }, [])

  const playComputerMove = useCallback((currentBoard: Board) => {
    setThinking(true)
    // A short delay both reads as "thinking" and gives React a chance to
    // paint that state first, since the search below runs synchronously.
    setTimeout(() => {
      const move = pickComputerMove(currentBoard, 'black', difficulty ?? 'medium')
      if (move) {
        const next = applyMove(currentBoard, move, 'black')
        setBoard(next)
        setLastMove({ from: move.from, to: move.to })
        setThinking(false)
        finishIfOver(next, 'black')
        return
      }
      setThinking(false)
    }, 400)
  }, [difficulty, finishIfOver])

  function tapSquare(r: number, c: number) {
    if (thinking || end) return
    if (selected) {
      const move = targets.find((m) => m.to[0] === r && m.to[1] === c)
      if (move) {
        const next = applyMove(board, move, 'red')
        setBoard(next)
        setSelected(null)
        setLastMove({ from: move.from, to: move.to })
        fireFeedback('correct')
        const over = finishIfOver(next, 'red')
        if (!over) playComputerMove(next)
        return
      }
      // Tapping a different one of your own movable pieces re-selects.
      if (movableFrom.has(`${r},${c}`)) {
        setSelected([r, c])
        return
      }
      setSelected(null)
      return
    }
    if (movableFrom.has(`${r},${c}`)) setSelected([r, c])
  }

  function restart() {
    setBoard(createInitialBoard())
    setSelected(null)
    setThinking(false)
    setEnd(null)
    setLastMove(null)
  }

  if (!difficulty) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <BackLink href={backHref} />
        <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
          <p className="mb-4 text-5xl" aria-hidden>⚫🔴</p>
          <h1 className="font-heading text-2xl font-bold text-ink">Checkers</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Pick who you&apos;re playing against</p>
          <div className="space-y-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className="w-full rounded-xl border-2 border-black/10 bg-background px-4 py-3 text-left transition-colors hover:border-maths hover:bg-maths/5"
              >
                <span className="font-heading font-bold text-ink">{d.label}</span>
                <span className="block text-xs text-muted">{d.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div className="flex items-center justify-between">
        <BackLink href={backHref} />
        <button
          onClick={restart}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> New game
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span className="h-3.5 w-3.5 rounded-full bg-[#FF6B6B]" aria-hidden /> You
        </span>
        <AnimatePresence mode="wait">
          {thinking ? (
            <motion.span
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs font-semibold text-muted"
            >
              Computer is thinking…
            </motion.span>
          ) : mustCapture && !end ? (
            <motion.span
              key="capture"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-bold text-incorrect"
            >
              You must capture!
            </motion.span>
          ) : null}
        </AnimatePresence>
        <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
          Computer <span className="h-3.5 w-3.5 rounded-full bg-[#2D3748]" aria-hidden />
        </span>
      </div>

      <div
        className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl border border-black/10 shadow-sm"
        role="group"
        aria-label="Checkers board"
      >
        {Array.from({ length: 8 }, (_, rowFromTop) => {
          const row = 7 - rowFromTop
          return Array.from({ length: 8 }, (_, col) => {
            const piece = board[row][col]
            const dark = (row + col) % 2 === 1
            const isSelected = selected && selected[0] === row && selected[1] === col
            const isTarget = targets.some((m) => m.to[0] === row && m.to[1] === col)
            const isLastMove = lastMove
              && ((lastMove.from[0] === row && lastMove.from[1] === col)
                || (lastMove.to[0] === row && lastMove.to[1] === col))
            const canTap = dark && (isTarget || movableFrom.has(`${row},${col}`))
            return (
              <button
                key={`${row}-${col}`}
                onClick={() => tapSquare(row, col)}
                disabled={!!end || !canTap}
                aria-label={
                  piece ? `${row + 1},${col + 1}, ${piece.color}${piece.king ? ' king' : ''}` : `${row + 1},${col + 1}`
                }
                className="relative flex aspect-square items-center justify-center transition-colors disabled:cursor-default"
                style={{
                  backgroundColor: !dark
                    ? '#F5EBDD'
                    : isSelected
                      ? 'rgba(108,158,255,0.55)'
                      : isLastMove
                        ? 'rgba(255,193,7,0.35)'
                        : '#8B5E3C',
                }}
              >
                {piece && (
                  <span
                    className="relative flex h-[72%] w-[72%] items-center justify-center rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
                    style={{ backgroundColor: piece.color === 'red' ? '#FF6B6B' : '#2D3748' }}
                  >
                    {piece.king && (
                      <Crown className="h-[55%] w-[55%] text-points-gold" aria-hidden />
                    )}
                  </span>
                )}
                {isTarget && !piece && (
                  <span className="absolute h-[26%] w-[26%] rounded-full bg-maths/60" aria-hidden />
                )}
              </button>
            )
          })
        })}
      </div>

      <AnimatePresence>
        {end && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm"
          >
            {end === 'win' && <WinBurst />}
            <div className="mb-2 flex justify-center">
              {end === 'win' ? (
                <Trophy className="h-10 w-10 text-points-gold" aria-hidden />
              ) : (
                <span className="text-4xl" aria-hidden>⚫</span>
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {end === 'win' ? 'You won!' : 'Good game!'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {end === 'win'
                ? 'You captured every piece — or the computer had nowhere left to move.'
                : 'The computer got you this time — have another go.'}
            </p>
            <button
              onClick={restart}
              className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-maths px-6 font-heading font-bold text-white transition-opacity hover:opacity-90"
            >
              Play again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden /> Downtime
    </Link>
  )
}
