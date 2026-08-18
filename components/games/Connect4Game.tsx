'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { fireFeedback } from '@/lib/feedback'
import { WinBurst } from '@/components/quiz/WinBurst'
import {
  createEmptyBoard, dropPiece, legalColumns, isBoardFull, winnerAt,
  pickComputerColumn, type Board, type Connect4Difficulty,
} from '@/lib/games/connect4-ai'
import { ChevronLeft, RefreshCw, Trophy, Scale } from '@/components/ui/icons'

const DIFFICULTIES: { id: Connect4Difficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Good for a first game' },
  { id: 'medium', label: 'Medium', blurb: 'Plays sensibly, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Spots your traps — and sets its own' },
]

type EndState = 'win' | 'loss' | 'draw' | null

/** Connect 4 against the computer. The child is always Red and drops first. */
export function Connect4Game({ backHref = '/downtime' }: { backHref?: string }) {
  const [difficulty, setDifficulty] = useState<Connect4Difficulty | null>(null)
  const boardRef = useRef<Board>(createEmptyBoard())
  const [, forceRender] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [end, setEnd] = useState<EndState>(null)
  const [lastDrop, setLastDrop] = useState<{ row: number; col: number } | null>(null)

  const board = boardRef.current

  const finishIfOver = useCallback((b: Board, row: number, col: number) => {
    const winner = winnerAt(b, row, col)
    if (winner) {
      setEnd(winner === 'red' ? 'win' : 'loss')
      fireFeedback(winner === 'red' ? 'roundComplete' : 'incorrect')
      return true
    }
    if (isBoardFull(b)) {
      setEnd('draw')
      return true
    }
    return false
  }, [])

  const playComputerMove = useCallback(() => {
    setThinking(true)
    setTimeout(() => {
      const col = pickComputerColumn(boardRef.current, 'yellow', difficulty ?? 'medium')
      if (col !== null) {
        const result = dropPiece(boardRef.current, col, 'yellow')
        if (result) {
          boardRef.current = result.board
          setLastDrop({ row: result.row, col })
          forceRender((n) => n + 1)
          setThinking(false)
          finishIfOver(result.board, result.row, col)
          return
        }
      }
      setThinking(false)
    }, 400)
  }, [difficulty, finishIfOver])

  function drop(col: number) {
    if (thinking || end) return
    if (!legalColumns(boardRef.current).includes(col)) return
    const result = dropPiece(boardRef.current, col, 'red')
    if (!result) return
    boardRef.current = result.board
    setLastDrop({ row: result.row, col })
    forceRender((n) => n + 1)
    fireFeedback('correct')
    const over = finishIfOver(result.board, result.row, col)
    if (!over) playComputerMove()
  }

  function restart() {
    boardRef.current = createEmptyBoard()
    forceRender((n) => n + 1)
    setThinking(false)
    setEnd(null)
    setLastDrop(null)
  }

  if (!difficulty) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <BackLink href={backHref} />
        <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
          <p className="mb-4 text-5xl" aria-hidden>🔴</p>
          <h1 className="font-heading text-2xl font-bold text-ink">Connect 4</h1>
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

  const legal = legalColumns(board)

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
          {thinking && (
            <motion.span
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs font-semibold text-muted"
            >
              Computer is thinking…
            </motion.span>
          )}
        </AnimatePresence>
        <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
          Computer <span className="h-3.5 w-3.5 rounded-full bg-[#FFD43B]" aria-hidden />
        </span>
      </div>

      <div className="rounded-2xl p-2" style={{ backgroundColor: '#3D6FD6' }}>
        {/* Column drop targets sit above the grid so the whole column is
            tappable, not just the top cell. */}
        <div className="grid grid-cols-7 gap-1 pb-1">
          {Array.from({ length: 7 }, (_, col) => (
            <button
              key={col}
              onClick={() => drop(col)}
              disabled={!legal.includes(col) || thinking || !!end}
              aria-label={`Drop in column ${col + 1}`}
              className="flex min-h-[36px] items-center justify-center rounded-lg transition-colors disabled:opacity-30"
              style={{ backgroundColor: legal.includes(col) && !end ? 'rgba(255,255,255,0.15)' : 'transparent' }}
            >
              <span className="text-white/70" aria-hidden>▼</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 6 }, (_, rowFromTop) => {
            const row = 5 - rowFromTop // render top-down; board[0] is the bottom row
            return Array.from({ length: 7 }, (_, col) => {
              const cell = board[row][col]
              const isLast = lastDrop && lastDrop.row === row && lastDrop.col === col
              return (
                <button
                  key={`${row}-${col}`}
                  onClick={() => drop(col)}
                  disabled={!legal.includes(col) || thinking || !!end}
                  aria-label={cell ? `${col + 1}, ${cell}` : `Drop in column ${col + 1}`}
                  className="relative flex aspect-square items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                >
                  <AnimatePresence>
                    {cell && (
                      <motion.span
                        initial={isLast ? { scale: 0.4, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        className="absolute inset-[8%] rounded-full shadow-inner"
                        style={{ backgroundColor: cell === 'red' ? '#FF6B6B' : '#FFD43B' }}
                        aria-hidden
                      />
                    )}
                  </AnimatePresence>
                </button>
              )
            })
          })}
        </div>
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
              ) : end === 'draw' ? (
                <Scale className="h-10 w-10 text-muted" aria-hidden />
              ) : (
                <span className="text-4xl" aria-hidden>🟡</span>
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {end === 'win' ? 'Four in a row — you won!' : end === 'draw' ? "It's a draw" : 'Good game!'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {end === 'win'
                ? 'Nicely spotted.'
                : end === 'draw'
                  ? 'The board filled up with nobody connecting four.'
                  : 'The computer connected four first — have another go.'}
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
