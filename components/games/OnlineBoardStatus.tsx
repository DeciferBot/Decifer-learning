'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BoardGameState, BoardSide } from '@/lib/downtime/useBoardGame'
import { Check, Link2, Users } from '@/components/ui/icons'

/** The "or play a friend instead" link under the difficulty picker — vs
 *  computer stays the default, one-tap path; this is the secondary option. */
export function PlayAFriendDivider({ onClick }: { onClick: () => void }) {
  return (
    <>
      <div className="my-4 flex items-center gap-2 text-xs font-semibold text-muted">
        <span className="h-px flex-1 bg-black/10" aria-hidden /> or <span className="h-px flex-1 bg-black/10" aria-hidden />
      </div>
      <button
        onClick={onClick}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold text-maths transition-colors hover:bg-maths/5"
      >
        <Users className="h-4 w-4" aria-hidden /> Play a friend
      </button>
    </>
  )
}

/** Shown while status === 'waiting': the host's code to share, or (for a
 *  reconnecting host) the same code fetched back from the server. */
export function WaitingRoom({ inviteCode, onCancel }: { inviteCode: string | null; onCancel: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard access can be denied — the code is still visible to read out
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
      <p className="mb-3 text-sm font-semibold text-muted">Share this code with your friend</p>
      <div className="mb-4 rounded-xl bg-background px-4 py-4">
        <p className="font-heading text-4xl font-extrabold tracking-[0.3em] text-ink">
          {inviteCode ?? '······'}
        </p>
      </div>
      <button
        onClick={copyCode}
        disabled={!inviteCode}
        className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-black/10 px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-maths disabled:opacity-50"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-correct" aria-hidden /> Copied
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" aria-hidden /> Copy code
          </>
        )}
      </button>
      <div className="mb-5 flex items-center justify-center gap-2 text-sm text-muted">
        <BouncingDots />
        <span>Waiting for your friend to join…</span>
      </div>
      <button onClick={onCancel} className="text-sm font-semibold text-muted">
        Cancel
      </button>
    </div>
  )
}

function BouncingDots() {
  return (
    <span className="flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-maths"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

/** Whose-turn indicator for an active online game. Renders nothing once the
 *  game is finished — the caller's own end screen takes over from there. */
export function TurnBanner({ game, side }: { game: BoardGameState; side: BoardSide }) {
  if (game.status !== 'active' || !side) return null
  const youAreUp = game.turn === side
  const opponentName = side === 'host' ? game.guest_display_name : game.host_display_name

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={youAreUp ? 'you' : 'them'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`text-center text-sm font-bold ${youAreUp ? 'text-correct' : 'text-muted'}`}
      >
        {youAreUp ? 'Your turn!' : `Waiting for ${opponentName ?? 'your friend'}…`}
      </motion.p>
    </AnimatePresence>
  )
}
