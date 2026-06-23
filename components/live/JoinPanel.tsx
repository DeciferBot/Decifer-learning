'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Swords, ArrowRight } from '@/components/ui/icons'

// Public join: PIN + (for guests) a nickname. No account required.
export function JoinPanel({ isLoggedIn, initialPin }: { isLoggedIn: boolean; initialPin: string }) {
  const router = useRouter()
  const [pin, setPin] = useState(initialPin)
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsNickname = !isLoggedIn
  const ready = pin.length === 6 && (!needsNickname || nickname.trim().length >= 1)

  async function join() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/live/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, nickname: nickname.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.error === 'game_not_found'
            ? "That code didn't match a game. Check the digits!"
            : data.error === 'game_already_started'
              ? 'That game already started.'
              : data.error === 'need_nickname'
                ? 'Pick a nickname first.'
                : 'Enter the 6-digit code.',
        )
        return
      }
      router.push(`/live/${data.gameId}`)
    } catch {
      setError('Network problem. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <header className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600">
          <Swords className="h-4 w-4" /> Decifer Live
        </div>
        <h1 className="font-heading text-2xl font-extrabold text-ink">Join the battle</h1>
        <p className="mt-1 text-sm text-muted">Type the game code your host is showing.</p>
      </header>

      <div className="space-y-5 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Game code</p>
          <input
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full rounded-xl border border-black/10 bg-background py-4 text-center font-mono text-3xl font-bold tracking-[0.4em] text-ink placeholder:text-muted/40"
          />
        </div>

        {needsNickname ? (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Nickname</p>
            <input
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Pick a fun name"
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-base font-semibold text-ink placeholder:text-muted/50"
            />
          </div>
        ) : null}

        {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={busy || !ready}
          onClick={join}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-heading text-base font-extrabold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Enter'} <ArrowRight className="h-5 w-5" />
        </motion.button>
      </div>
    </div>
  )
}
