'use client'

import { useCallback, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { fireFeedback } from '@/lib/feedback'
import { WinBurst } from '@/components/quiz/WinBurst'
import { pickComputerMove, type ChessDifficulty } from '@/lib/games/chess-ai'
import { ChevronLeft, RefreshCw, Trophy, Scale } from '@/components/ui/icons'

const PIECE_GLYPH: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const

const DIFFICULTIES: { id: ChessDifficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'A relaxed opponent — good for learning the moves' },
  { id: 'medium', label: 'Medium', blurb: 'Plays sensibly, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Thinks ahead — your best game' },
]

type EndState = 'win' | 'loss' | 'draw' | null

/**
 * Chess against the computer. The child always plays White; the AI (see
 * lib/games/chess-ai.ts) plays Black. Pawns always promote to a queen —
 * choosing an under-promotion is a real (if rare) part of chess, but the
 * choice-of-piece modal it needs is cut from this first pass to keep the
 * board interaction simple; queen is what almost every promotion wants
 * anyway.
 */
export function ChessGame({ backHref = '/downtime' }: { backHref?: string }) {
  const [difficulty, setDifficulty] = useState<ChessDifficulty | null>(null)
  const gameRef = useRef(new Chess())
  const [fen, setFen] = useState(() => gameRef.current.fen())
  const [selected, setSelected] = useState<Square | null>(null)
  const [thinking, setThinking] = useState(false)
  const [end, setEnd] = useState<EndState>(null)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)

  const game = gameRef.current

  const legalTargets = selected
    ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
    : []

  const checkEnd = useCallback((g: Chess) => {
    if (!g.isGameOver()) return
    if (g.isCheckmate()) {
      // The side to move has been checkmated. White is the child.
      setEnd(g.turn() === 'w' ? 'loss' : 'win')
      fireFeedback(g.turn() === 'w' ? 'incorrect' : 'roundComplete')
    } else {
      setEnd('draw')
    }
  }, [])

  const playComputerMove = useCallback(() => {
    setThinking(true)
    // A short delay both reads as "thinking" and — because the search below
    // is a blocking call — gives React a chance to paint that state first,
    // so the board never looks like it just froze.
    setTimeout(() => {
      const g = gameRef.current
      const move = pickComputerMove(g.fen(), difficulty ?? 'medium')
      if (move) {
        const applied = g.move(move)
        if (applied) setLastMove({ from: applied.from, to: applied.to })
      }
      setFen(g.fen())
      setThinking(false)
      checkEnd(g)
    }, 350)
  }, [difficulty, checkEnd])

  function tapSquare(square: Square) {
    if (thinking || end) return
    const g = gameRef.current

    if (selected) {
      if (legalTargets.includes(square)) {
        const candidates = g.moves({ square: selected, verbose: true })
          .filter((m) => m.to === square)
        const chosen = candidates.find((m) => m.promotion === 'q') ?? candidates[0]
        const applied = chosen
          ? g.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion })
          : null
        setSelected(null)
        if (applied) {
          fireFeedback('correct')
          setLastMove({ from: applied.from, to: applied.to })
          setFen(g.fen())
          if (g.isGameOver()) {
            checkEnd(g)
          } else {
            playComputerMove()
          }
          return
        }
      }
      // Tapping a different one of your own pieces re-selects instead of
      // just deselecting — one tap fewer to change your mind.
      const piece = g.get(square)
      if (piece && piece.color === g.turn()) {
        setSelected(square)
        return
      }
      setSelected(null)
      return
    }

    const piece = g.get(square)
    if (piece && piece.color === g.turn() && g.turn() === 'w') {
      setSelected(square)
    }
  }

  function restart() {
    gameRef.current = new Chess()
    setFen(gameRef.current.fen())
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
          <p className="mb-4 text-5xl" aria-hidden>♟️</p>
          <h1 className="font-heading text-2xl font-bold text-ink">Chess</h1>
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

  const inCheck = game.inCheck() && !end

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
        <span className="font-semibold text-ink">You (White)</span>
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
          ) : inCheck ? (
            <motion.span
              key="check"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-bold text-incorrect"
            >
              Check!
            </motion.span>
          ) : null}
        </AnimatePresence>
        <span className="font-semibold text-muted">Computer (Black)</span>
      </div>

      <div className="relative">
        <div
          className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl border border-black/10 shadow-sm"
          role="group"
          aria-label="Chess board"
        >
          {RANKS.flatMap((rank) =>
            FILES.map((file) => {
              // FILES × RANKS enumerates exactly the 64 valid squares, so this
              // is a real, safe cast — not an escape hatch.
              const square = `${file}${rank}` as Square
              const piece = game.get(square)
              const isDark = (FILES.indexOf(file) + rank) % 2 === 0
              const isSelected = selected === square
              const isTarget = legalTargets.includes(square)
              const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square)
              return (
                <button
                  key={square}
                  onClick={() => tapSquare(square)}
                  disabled={!!end}
                  aria-label={
                    piece
                      ? `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}`
                      : square
                  }
                  className="relative flex aspect-square items-center justify-center text-[min(7.5vw,28px)] leading-none transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? 'rgba(108,158,255,0.45)'
                      : isLastMove
                        ? 'rgba(255,193,7,0.28)'
                        : isDark
                          ? '#B7C4D9'
                          : '#F3F6FB',
                  }}
                >
                  {piece && (
                    <span
                      style={{ color: piece.color === 'w' ? '#FFFFFF' : '#1A1F2B' }}
                      className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
                    >
                      {PIECE_GLYPH[`${piece.color}${piece.type}`]}
                    </span>
                  )}
                  {isTarget && !piece && (
                    <span className="absolute h-[26%] w-[26%] rounded-full bg-maths/50" aria-hidden />
                  )}
                  {isTarget && piece && (
                    <span className="absolute inset-1 rounded-full border-[3px] border-maths/60" aria-hidden />
                  )}
                </button>
              )
            }),
          )}
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
                <span className="text-4xl" aria-hidden>♟️</span>
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {end === 'win' ? 'Checkmate — you won!' : end === 'draw' ? "It's a draw" : 'Good game!'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {end === 'win'
                ? 'Nicely played.'
                : end === 'draw'
                  ? 'Neither side could break through.'
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
