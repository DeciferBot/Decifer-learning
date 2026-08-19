'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { BoardGameState, BoardSide } from '@/lib/downtime/useBoardGame'
import { Check, Link2, Users } from '@/components/ui/icons'

/** The "or play a friend instead" link under the difficulty picker — vs
 *  computer stays the default, one-tap path; this is the secondary option. */
export function PlayAFriendDivider({ onClick }: { onClick: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 pt-1 text-xs font-semibold text-muted">
        <span className="h-px flex-1 bg-black/10" aria-hidden /> or <span className="h-px flex-1 bg-black/10" aria-hidden />
      </div>
      <button
        onClick={onClick}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-brand/25 bg-brand/[0.06] px-4 text-sm font-bold text-brand-700 transition-colors hover:bg-brand/10"
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
    <div className="rounded-2xl border border-black/[0.07] bg-surface p-6 text-center shadow-sm">
      <p className="mb-3 text-sm font-semibold text-ink-2">Share this code with your friend</p>

      {/* The code is the whole point of this screen, so it is set as an
          object to read out loud: mono, wide-tracked, on a recessed panel.
          Letter-spacing pushes the text right, so the padding is offset to
          keep it optically centred. */}
      <div
        className="mb-4 rounded-xl px-4 py-5"
        style={{
          background: 'var(--surface-sunken)',
          boxShadow: 'inset 0 2px 4px rgb(31 26 20 / 0.10)',
        }}
      >
        <p className="pl-[0.3em] font-mono text-[2rem] font-extrabold leading-none tracking-[0.3em] text-ink">
          {inviteCode ?? '······'}
        </p>
      </div>

      <button
        onClick={copyCode}
        disabled={!inviteCode}
        className="mb-5 inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-black/10 bg-surface px-4 text-sm font-semibold text-ink-2 shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/[0.04] disabled:opacity-50"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-correct-700" aria-hidden /> Copied
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" aria-hidden /> Copy code
          </>
        )}
      </button>
      {/* Announced, so a screen-reader user learns the copy worked. */}
      <span className="sr-only" role="status">{copied ? 'Code copied' : ''}</span>

      <p className="mb-5 flex items-center justify-center gap-2 text-sm text-ink-2">
        <BouncingDots />
        <span>Waiting for your friend to join…</span>
      </p>
      <button onClick={onCancel} className="min-h-[48px] px-4 text-sm font-semibold text-ink-2">
        Cancel
      </button>
    </div>
  )
}

/** The "still waiting" pulse. Framer drives it in JS, so the global
 *  prefers-reduced-motion rule in globals.css does not reach it: the dots
 *  are held still by hand instead. */
function BouncingDots() {
  const reduceMotion = useReducedMotion()
  return (
    <span className="flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-brand"
          animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.3, 1, 0.3] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
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
        aria-live="polite"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`rounded-xl px-3 py-2 text-center text-sm font-bold ${
          youAreUp ? 'bg-brand/10 text-brand-700' : 'bg-black/[0.04] text-ink-2'
        }`}
      >
        {youAreUp ? 'Your turn' : `Waiting for ${opponentName ?? 'your friend'}…`}
      </motion.p>
    </AnimatePresence>
  )
}
