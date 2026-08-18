'use client'

import { useState } from 'react'
import { Link2, RefreshCw } from '@/components/ui/icons'

type GameType = 'chess' | 'checkers' | 'connect4'

const ERROR_COPY: Record<string, string> = {
  need_nickname: 'Pick a name first.',
  nickname_not_allowed: 'Try a different name.',
  game_not_found: "That code didn't match a game.",
  game_already_started: 'That game already started — ask for a new code.',
}

function friendlyError(code: string | null): string | null {
  if (!code) return null
  return ERROR_COPY[code] ?? 'Something went wrong — try again.'
}

/** The "play a friend" entry screen: create a new invite code, or join one.
 *  Once a game exists, hands off its id to the parent — the parent owns
 *  everything from there (waiting room, board, turns) via useBoardGame. */
export function OnlineLobby({
  gameType,
  onReady,
  onBack,
}: {
  gameType: GameType
  onReady: (gameId: string) => void
  onBack: () => void
}) {
  const [subMode, setSubMode] = useState<'choose' | 'join'>('choose')
  const [nickname, setNickname] = useState('')
  const [needsNickname, setNeedsNickname] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createGame() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/downtime/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType, nickname: nickname.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'need_nickname' || data.error === 'nickname_not_allowed') setNeedsNickname(true)
        setError(friendlyError(data.error))
        return
      }
      onReady(data.gameId)
    } catch {
      setError('Something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  async function joinGame() {
    const trimmed = code.trim()
    if (trimmed.length !== 6) {
      setError('Codes are 6 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/downtime/games/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: trimmed, nickname: nickname.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'need_nickname' || data.error === 'nickname_not_allowed') setNeedsNickname(true)
        setError(friendlyError(data.error))
        return
      }
      onReady(data.gameId)
    } catch {
      setError('Something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  if (subMode === 'choose') {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
        <p className="mb-4 text-4xl" aria-hidden>🧑‍🤝‍🧑</p>
        <h2 className="font-heading text-xl font-bold text-ink">Play a friend</h2>
        <p className="mt-1 mb-5 text-sm text-muted">Create a game and share the code, or join one</p>
        {needsNickname && (
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            className="mb-3 w-full rounded-xl border-2 border-black/10 bg-background px-4 py-3 text-center font-semibold text-ink outline-none focus:border-maths"
          />
        )}
        {error && <p className="mb-3 text-sm font-semibold text-incorrect">{error}</p>}
        <div className="space-y-2">
          <button
            onClick={createGame}
            disabled={busy}
            className="w-full rounded-xl bg-maths px-4 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create a game'}
          </button>
          <button
            onClick={() => { setSubMode('join'); setError(null) }}
            disabled={busy}
            className="w-full rounded-xl border-2 border-black/10 bg-background px-4 py-3 font-heading font-bold text-ink transition-colors hover:border-maths hover:bg-maths/5"
          >
            Join with a code
          </button>
          <button
            onClick={onBack}
            className="w-full px-4 py-2 text-sm font-semibold text-muted"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm">
      <p className="mb-4 text-4xl" aria-hidden><Link2 className="mx-auto h-10 w-10 text-maths" aria-hidden /></p>
      <h2 className="font-heading text-xl font-bold text-ink">Join a game</h2>
      <p className="mt-1 mb-5 text-sm text-muted">Type the 6-character code your friend shared</p>
      {needsNickname && (
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          className="mb-3 w-full rounded-xl border-2 border-black/10 bg-background px-4 py-3 text-center font-semibold text-ink outline-none focus:border-maths"
        />
      )}
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="ABC123"
        maxLength={6}
        autoCapitalize="characters"
        className="mb-3 w-full rounded-xl border-2 border-black/10 bg-background px-4 py-3 text-center font-heading text-2xl font-bold tracking-[0.3em] text-ink outline-none focus:border-maths"
      />
      {error && <p className="mb-3 text-sm font-semibold text-incorrect">{error}</p>}
      <div className="space-y-2">
        <button
          onClick={joinGame}
          disabled={busy || code.trim().length !== 6}
          className="w-full rounded-xl bg-maths px-4 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? (
            <span className="inline-flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Joining…
            </span>
          ) : 'Join'}
        </button>
        <button
          onClick={() => { setSubMode('choose'); setError(null) }}
          disabled={busy}
          className="w-full px-4 py-2 text-sm font-semibold text-muted"
        >
          Back
        </button>
      </div>
    </div>
  )
}
