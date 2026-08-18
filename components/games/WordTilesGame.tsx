'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fireFeedback } from '@/lib/feedback'
import { WinBurst } from '@/components/quiz/WinBurst'
import { BOARD_SIZE, PREMIUM_LAYOUT, type Premium } from '@/lib/games/scrabble-board'
import type { ScrabbleBoard } from '@/lib/games/scrabble-engine'
import { useBoardGame } from '@/lib/downtime/useBoardGame'
import { OnlineLobby } from '@/components/games/OnlineLobby'
import { WaitingRoom } from '@/components/games/OnlineBoardStatus'
import { ChevronLeft, Trophy, Scale, RefreshCw, X as ClearIcon } from '@/components/ui/icons'

type Coord = { row: number; col: number }
type Pending = { row: number; col: number; rackIndex: number; letter: string; isBlank: boolean }

const PREMIUM_LABEL: Record<Exclude<Premium, null>, string> = { TW: 'TW', DW: 'DW', TL: 'TL', DL: 'DL' }
const PREMIUM_COLOR: Record<Exclude<Premium, null>, string> = {
  TW: '#FF8FAB', DW: '#FFD3A8', TL: '#8FC5FF', DL: '#B9DDFF',
}

const KEYBOARD_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type ScrabblePublicState = {
  board: ScrabbleBoard
  bagCount: number
  hostScore: number
  guestScore: number
  consecutivePasses: number
  lastMove: { by: 'host' | 'guest'; type: 'place' | 'pass' | 'exchange'; words: string[]; points: number } | null
}

/** Word Tiles — the classic tile-and-board word game, played with a friend
 *  via invite code (no single-player mode: a strong AI opponent for this
 *  game is a much bigger undertaking than Chess/Checkers/Connect 4's, so
 *  this first pass is multiplayer-only). */
export function WordTilesGame({ backHref = '/downtime' }: { backHref?: string }) {
  const router = useRouter()
  const [gameId, setGameId] = useState<string | null>(null)

  if (gameId) {
    return <WordTilesOnlineGame gameId={gameId} backHref={backHref} onExit={() => setGameId(null)} />
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <BackLink href={backHref} />
      <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
        <p className="mb-4 text-5xl" aria-hidden>🔤</p>
        <h1 className="font-heading text-2xl font-bold text-ink">Word Tiles</h1>
        <p className="mt-1 mb-5 text-sm text-muted">Build words on a shared board — most points wins. Play with a friend.</p>
      </div>
      <OnlineLobby gameType="scrabble" onReady={setGameId} onBack={() => router.push(backHref)} />
    </div>
  )
}

function WordTilesOnlineGame({ gameId, backHref, onExit }: { gameId: string; backHref: string; onExit: () => void }) {
  const { game, side, inviteCode, rack, ready, notFound, moveError, sendMove } = useBoardGame(gameId)
  const [pending, setPending] = useState<Pending[]>([])
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null)
  const [blankPromptFor, setBlankPromptFor] = useState<Coord | null>(null)
  const [exchangeMode, setExchangeMode] = useState(false)
  const [exchangeSelection, setExchangeSelection] = useState<Set<number>>(new Set())
  // Guards Play word / Pass / Swap against a double-tap firing two in-flight
  // requests — the server independently rejects a losing race as a
  // 'conflict' (see the move route), this just makes it rare in practice.
  const [submitting, setSubmitting] = useState(false)

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

  const state = game.state as ScrabblePublicState
  const board = state.board
  const myTurn = game.status === 'active' && game.turn === side
  const won = game.winner
  const myScore = side === 'host' ? state.hostScore : state.guestScore
  const opponentScore = side === 'host' ? state.guestScore : state.hostScore
  const opponentName = side === 'host' ? (game.guest_display_name ?? 'Friend') : game.host_display_name

  const pendingByCell = new Map(pending.map((p) => [`${p.row},${p.col}`, p]))
  const hiddenRackIndices = new Set(pending.map((p) => p.rackIndex))

  function pickRackTile(index: number) {
    if (!myTurn || hiddenRackIndices.has(index) || !rack) return
    if (exchangeMode) {
      setExchangeSelection((prev) => {
        const next = new Set(prev)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
      })
      return
    }
    setSelectedRackIndex(index === selectedRackIndex ? null : index)
  }

  function placeAt(row: number, col: number) {
    if (!myTurn || !rack || selectedRackIndex === null) return
    if (board[row][col] || pendingByCell.has(`${row},${col}`)) return
    const symbol = rack[selectedRackIndex]
    if (symbol === '_') {
      setBlankPromptFor({ row, col })
      return
    }
    setPending((prev) => [...prev, { row, col, rackIndex: selectedRackIndex, letter: symbol, isBlank: false }])
    setSelectedRackIndex(null)
    fireFeedback('correct')
  }

  function chooseBlankLetter(letter: string) {
    if (!blankPromptFor || selectedRackIndex === null) return
    setPending((prev) => [...prev, { ...blankPromptFor, rackIndex: selectedRackIndex, letter, isBlank: true }])
    setBlankPromptFor(null)
    setSelectedRackIndex(null)
    fireFeedback('correct')
  }

  function pickUpPending(row: number, col: number) {
    if (!myTurn) return
    setPending((prev) => prev.filter((p) => !(p.row === row && p.col === col)))
  }

  async function submitPlacement() {
    if (pending.length === 0 || submitting) return
    setSubmitting(true)
    const ok = await sendMove({
      type: 'place',
      tiles: pending.map((p) => ({ row: p.row, col: p.col, letter: p.letter, isBlank: p.isBlank })),
    })
    setSubmitting(false)
    if (ok) {
      setPending([])
      fireFeedback('roundComplete')
    } else {
      fireFeedback('incorrect')
    }
  }

  async function submitPass() {
    if (submitting) return
    setSubmitting(true)
    const ok = await sendMove({ type: 'pass' })
    setSubmitting(false)
    if (ok) setPending([])
  }

  async function submitExchange() {
    if (!rack || exchangeSelection.size === 0 || submitting) return
    setSubmitting(true)
    const tiles = [...exchangeSelection].map((i) => rack[i])
    const ok = await sendMove({ type: 'exchange', tiles })
    setSubmitting(false)
    if (ok) {
      setExchangeMode(false)
      setExchangeSelection(new Set())
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-3">
      <BackLink href={backHref} onClick={onExit} />

      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-2.5 text-sm shadow-sm">
        <span className="font-bold text-ink">You: {myScore}</span>
        <span className="text-xs text-muted">{state.bagCount} tiles left</span>
        <span className="font-semibold text-muted">{opponentName}: {opponentScore}</span>
      </div>

      {!won && (
        <p className={`text-center text-sm font-bold ${myTurn ? 'text-correct' : 'text-muted'}`}>
          {myTurn ? 'Your turn!' : `Waiting for ${opponentName}…`}
        </p>
      )}
      {state.lastMove && state.lastMove.type === 'place' && (
        <p className="text-center text-xs text-muted">
          {state.lastMove.by === side ? 'You' : opponentName} played {state.lastMove.words.join(', ')} for {state.lastMove.points} points
        </p>
      )}
      {moveError && <p className="text-center text-xs font-semibold text-incorrect">That move isn&apos;t allowed — try again.</p>}

      <div className="overflow-auto rounded-xl border border-black/10 bg-surface p-1.5 shadow-sm">
        <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 26px)` }}>
          {Array.from({ length: BOARD_SIZE }, (_, r) => (
            Array.from({ length: BOARD_SIZE }, (_, c) => {
              const committed = board[r][c]
              const pendingTile = pendingByCell.get(`${r},${c}`)
              const premium = PREMIUM_LAYOUT[r][c]
              const empty = !committed && !pendingTile
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => (pendingTile ? pickUpPending(r, c) : placeAt(r, c))}
                  disabled={!myTurn || (!!committed) || (!pendingTile && selectedRackIndex === null)}
                  aria-label={`Row ${r + 1}, column ${c + 1}`}
                  className="relative flex h-[26px] w-[26px] items-center justify-center border border-black/10 text-xs font-bold uppercase"
                  style={{
                    backgroundColor: pendingTile
                      ? 'rgba(108,158,255,0.35)'
                      : committed
                        ? '#FFFFFF'
                        : premium
                          ? PREMIUM_COLOR[premium]
                          : '#F5EBDD',
                  }}
                >
                  {committed?.letter ?? pendingTile?.letter ?? (empty && premium ? PREMIUM_LABEL[premium] : '')}
                  {(committed?.isBlank || pendingTile?.isBlank) && (
                    <span className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full bg-maths" aria-hidden />
                  )}
                </button>
              )
            })
          ))}
        </div>
      </div>

      {rack && (
        <div className="rounded-xl border border-black/10 bg-surface p-2 shadow-sm">
          <div className="flex flex-wrap justify-center gap-1.5">
            {rack.map((symbol, i) => (
              <button
                key={i}
                onClick={() => pickRackTile(i)}
                disabled={!myTurn || hiddenRackIndices.has(i)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold uppercase shadow-sm transition-transform disabled:opacity-30"
                style={{
                  backgroundColor: exchangeMode && exchangeSelection.has(i)
                    ? 'rgba(255,107,107,0.5)'
                    : selectedRackIndex === i ? 'rgba(108,158,255,0.5)' : '#F5EBDD',
                  transform: selectedRackIndex === i ? 'translateY(-4px)' : undefined,
                }}
              >
                {symbol === '_' ? '?' : symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {myTurn && !won && !exchangeMode && (
        <div className="flex gap-2">
          <button
            onClick={submitPlacement}
            disabled={pending.length === 0 || submitting}
            className="flex-1 rounded-xl bg-maths px-4 py-2.5 text-sm font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Play word
          </button>
          <button
            onClick={() => setPending([])}
            disabled={pending.length === 0 || submitting}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-black/10 px-3 text-sm font-semibold text-ink-2 disabled:opacity-40"
          >
            <ClearIcon className="h-4 w-4" aria-hidden /> Clear
          </button>
          <button
            onClick={() => setExchangeMode(true)}
            disabled={pending.length > 0 || submitting}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-black/10 px-3 text-sm font-semibold text-ink-2 disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Swap
          </button>
          <button
            onClick={submitPass}
            disabled={pending.length > 0 || submitting}
            className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-black/10 px-3 text-sm font-semibold text-ink-2 disabled:opacity-40"
          >
            Pass
          </button>
        </div>
      )}

      {myTurn && exchangeMode && (
        <div className="flex gap-2">
          <button
            onClick={submitExchange}
            disabled={exchangeSelection.size === 0 || submitting}
            className="flex-1 rounded-xl bg-maths px-4 py-2.5 text-sm font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Swap {exchangeSelection.size || ''} tile{exchangeSelection.size === 1 ? '' : 's'}
          </button>
          <button
            onClick={() => { setExchangeMode(false); setExchangeSelection(new Set()) }}
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-black/10 px-3 text-sm font-semibold text-ink-2 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}

      <AnimatePresence>
        {blankPromptFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setBlankPromptFor(null)}
          >
            <div
              className="w-full max-w-xs rounded-2xl bg-surface p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-3 text-center text-sm font-bold text-ink">Blank tile — which letter?</p>
              <div className="grid grid-cols-7 gap-1.5">
                {KEYBOARD_LETTERS.map((l) => (
                  <button
                    key={l}
                    onClick={() => chooseBlankLetter(l)}
                    className="flex min-h-[36px] items-center justify-center rounded-lg bg-background text-sm font-bold text-ink hover:bg-maths/10"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm"
          >
            {won === side && <WinBurst />}
            <div className="mb-2 flex justify-center">
              {won === side ? (
                <Trophy className="h-10 w-10 text-points-gold" aria-hidden />
              ) : won === 'draw' ? (
                <Scale className="h-10 w-10 text-muted" aria-hidden />
              ) : (
                <span className="text-4xl" aria-hidden>🔤</span>
              )}
            </div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {won === side ? 'You won!' : won === 'draw' ? "It's a draw" : 'Good game!'}
            </h2>
            <p className="mt-1 text-sm text-muted">Final score — you: {myScore}, {opponentName}: {opponentScore}</p>
            <button
              onClick={onExit}
              className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-maths px-6 font-heading font-bold text-white transition-opacity hover:opacity-90"
            >
              Back to Downtime
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
