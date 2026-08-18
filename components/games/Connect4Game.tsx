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
import { useBoardGame } from '@/lib/downtime/useBoardGame'
import { OnlineLobby } from '@/components/games/OnlineLobby'
import { WaitingRoom, TurnBanner, PlayAFriendDivider } from '@/components/games/OnlineBoardStatus'
import { ChevronLeft, RefreshCw, Trophy, Scale } from '@/components/ui/icons'

const DIFFICULTIES: { id: Connect4Difficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Good for a first game' },
  { id: 'medium', label: 'Medium', blurb: 'Plays sensibly, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Spots your traps — and sets its own' },
]

type EndState = 'win' | 'loss' | 'draw' | null
type Screen = 'difficulty' | 'online-lobby'

/** Connect 4 — against the computer, or against a friend via invite code.
 *  In both modes the child is always Red and drops first. Computer mode is
 *  the default landing screen; "play a friend" is a secondary option. */
export function Connect4Game({ backHref = '/downtime' }: { backHref?: string }) {
  const [screen, setScreen] = useState<Screen>('difficulty')
  const [difficulty, setDifficulty] = useState<Connect4Difficulty | null>(null)
  const [onlineGameId, setOnlineGameId] = useState<string | null>(null)

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

  function exitToMenu() {
    setScreen('difficulty')
    setDifficulty(null)
    setOnlineGameId(null)
    restart()
  }

  if (onlineGameId) {
    return <Connect4OnlineGame gameId={onlineGameId} backHref={backHref} onExit={exitToMenu} />
  }

  if (screen === 'online-lobby') {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <BackLink href={backHref} />
        <OnlineLobby gameType="connect4" onReady={setOnlineGameId} onBack={() => setScreen('difficulty')} />
      </div>
    )
  }

  if (!difficulty) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <BackLink href={backHref} />
        <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
          <p className="mb-4 text-5xl" aria-hidden>🔴</p>
          <h1 className="font-heading text-2xl font-bold text-ink">Connect 4</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Pick a difficulty</p>
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
          <PlayAFriendDivider onClick={() => setScreen('online-lobby')} />
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

      <Connect4Grid board={board} legal={legal} onDrop={drop} disabled={thinking || !!end} lastDrop={lastDrop} />

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

/** The 7x6 grid + column drop targets, shared between computer and online
 *  modes — only the data source and the drop handler differ. */
function Connect4Grid({
  board, legal, onDrop, disabled, lastDrop,
}: {
  board: Board
  legal: number[]
  onDrop: (col: number) => void
  disabled: boolean
  lastDrop: { row: number; col: number } | null
}) {
  return (
    <div className="rounded-2xl p-2" style={{ backgroundColor: '#3D6FD6' }}>
      <div className="grid grid-cols-7 gap-1 pb-1">
        {Array.from({ length: 7 }, (_, col) => (
          <button
            key={col}
            onClick={() => onDrop(col)}
            disabled={!legal.includes(col) || disabled}
            aria-label={`Drop in column ${col + 1}`}
            className="flex min-h-[36px] items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            style={{ backgroundColor: legal.includes(col) && !disabled ? 'rgba(255,255,255,0.15)' : 'transparent' }}
          >
            <span className="text-white/70" aria-hidden>▼</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 6 }, (_, rowFromTop) => {
          const row = 5 - rowFromTop
          return Array.from({ length: 7 }, (_, col) => {
            const cell = board[row][col]
            const isLast = lastDrop && lastDrop.row === row && lastDrop.col === col
            return (
              <button
                key={`${row}-${col}`}
                onClick={() => onDrop(col)}
                disabled={!legal.includes(col) || disabled}
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
  )
}

/** Online mode: board comes from useBoardGame, moves go through sendMove. */
function Connect4OnlineGame({
  gameId, backHref, onExit,
}: {
  gameId: string
  backHref: string
  onExit: () => void
}) {
  const { game, side, inviteCode, ready, notFound, sendMove } = useBoardGame(gameId)

  if (!ready) return <CenteredMessage backHref={backHref} text="Loading…" />
  if (notFound) return <CenteredMessage backHref={backHref} text="That game couldn't be found." />
  if (!side || !game) return <CenteredMessage backHref={backHref} text="This game isn't yours." />

  if (game.status === 'waiting') {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <BackLink href={backHref} onClick={onExit} />
        <WaitingRoom inviteCode={inviteCode} onCancel={onExit} />
      </div>
    )
  }

  const boardState = game.state as { board: Board }
  const board = boardState.board
  const myColor = side === 'host' ? 'red' : 'yellow'
  const myTurn = game.status === 'active' && game.turn === side
  const legal = myTurn ? legalColumns(board) : []

  function handleDrop(col: number) {
    if (!myTurn) return
    fireFeedback('correct')
    sendMove({ col })
  }

  const won = game.winner
  const iWon = won === side
  const isDraw = won === 'draw'

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div className="flex items-center justify-between">
        <BackLink href={backHref} onClick={onExit} />
      </div>

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span className="h-3.5 w-3.5 rounded-full bg-[#FF6B6B]" aria-hidden /> {side === 'host' ? 'You' : game.host_display_name}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
          {side === 'guest' ? 'You' : (game.guest_display_name ?? 'Friend')} <span className="h-3.5 w-3.5 rounded-full bg-[#FFD43B]" aria-hidden />
        </span>
      </div>

      <TurnBanner game={game} side={side} />

      <Connect4Grid board={board} legal={legal} onDrop={handleDrop} disabled={!myTurn || !!won} lastDrop={null} />

      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm"
          >
            {iWon && <WinBurst />}
            <div className="mb-2 flex justify-center">
              {iWon ? (
                <Trophy className="h-10 w-10 text-points-gold" aria-hidden />
              ) : isDraw ? (
                <Scale className="h-10 w-10 text-muted" aria-hidden />
              ) : (
                <span className="text-4xl" aria-hidden>🟡</span>
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {iWon ? 'Four in a row — you won!' : isDraw ? "It's a draw" : 'Good game!'}
            </h2>
            <button
              onClick={onExit}
              className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-maths px-6 font-heading font-bold text-white transition-opacity hover:opacity-90"
            >
              Back to Downtime
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {myColor === 'yellow' && !won && game.status === 'active' && (
        <p className="text-center text-xs text-muted">You&apos;re playing yellow this game.</p>
      )}
    </div>
  )
}

function CenteredMessage({ backHref, text }: { backHref: string; text: string }) {
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <BackLink href={backHref} />
      <p className="rounded-2xl border border-black/5 bg-surface p-6 text-center text-sm text-muted shadow-sm">{text}</p>
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
