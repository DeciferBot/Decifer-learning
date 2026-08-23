'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { reportGameResult, type GameResultInput, type SaveStatus } from '@/lib/games/results'

/**
 * Reports a finished game to /api/downtime/results, exactly once per game.
 *
 * Pass the result when the game reaches its end state and null while it is
 * still in play — a new game (result back to null) re-arms the hook. The
 * report fires on the transition to non-null and is guarded by a ref, so
 * re-renders while the end card is up (or an unstable object identity at the
 * call site) never double-post.
 */
export function useGameResult(result: GameResultInput | null): SaveStatus | null {
  const [status, setStatus] = useState<SaveStatus | null>(null)
  const reported = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!result) {
      reported.current = false
      setStatus(null)
      return
    }
    if (reported.current) return
    reported.current = true
    reportGameResult(result).then((s) => {
      if (mounted.current) setStatus(s)
    })
  }, [result])

  return status
}

/**
 * The line under the game-over card that answers "did that count?".
 *
 * Logged in: a quiet confirmation that the game landed in their history.
 * Signed out (the public /games pages need no login): the one moment a
 * registration nudge is worth showing — the child has just finished a game
 * they might want to keep. A failed report says nothing at all; a game of
 * Downtime is not worth an error message.
 */
export function GameResultNote({ status }: { status: SaveStatus | null }) {
  if (status === 'saved') {
    return (
      <p className="text-xs font-semibold text-ink-2" role="status">
        Saved to your game history.
      </p>
    )
  }
  if (status === 'signed_out') {
    return (
      <div className="rounded-xl border border-brand/20 bg-brand/[0.06] px-4 py-3 text-left">
        <p className="text-sm font-bold text-ink">Playing as a guest</p>
        <p className="mt-0.5 text-pretty text-xs text-ink-2">
          Sign up free and every game you finish is saved, so your scores and
          history are there whenever you come back.
        </p>
        <Link
          href="/register"
          className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand/30 bg-surface px-4 font-heading text-sm font-bold text-brand-700 transition-colors hover:bg-brand/10"
        >
          Create a free account
        </Link>
      </div>
    )
  }
  return null
}
