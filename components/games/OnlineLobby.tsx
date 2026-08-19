'use client'

import { useId, useState } from 'react'
import { Link2, RefreshCw, Users } from '@/components/ui/icons'

type GameType = 'chess' | 'checkers' | 'connect4' | 'scrabble'

const ERROR_COPY: Record<string, string> = {
  need_nickname: 'Pick a name first.',
  nickname_not_allowed: 'Try a different name.',
  game_not_found: "That code didn't match a game.",
  game_already_started: 'That game already started. Ask your friend for a new code.',
}

function friendlyError(code: string | null): string | null {
  if (!code) return null
  return ERROR_COPY[code] ?? 'Something went wrong. Try again.'
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
  const nameId = useId()
  const codeId = useId()

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
      setError('Something went wrong. Try again.')
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
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (subMode === 'choose') {
    return (
      <LobbyCard icon={<Users className="h-7 w-7" aria-hidden />} title="Play a friend" blurb="Create a game and share the code, or join one they made.">
        {needsNickname && (
          <NameField id={nameId} value={nickname} onChange={setNickname} />
        )}
        <ErrorLine message={error} />
        <button
          onClick={createGame}
          disabled={busy}
          className="min-h-[48px] w-full rounded-xl bg-brand-600 px-4 font-heading font-bold text-white transition-colors hover:bg-brand-700 disabled:bg-black/10 disabled:text-muted"
        >
          {busy ? 'Creating…' : 'Create a game'}
        </button>
        <button
          onClick={() => { setSubMode('join'); setError(null) }}
          disabled={busy}
          className="min-h-[48px] w-full rounded-xl border border-black/10 bg-surface px-4 font-heading font-bold text-ink shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/[0.04] disabled:opacity-50"
        >
          Join with a code
        </button>
        <button onClick={onBack} className="min-h-[48px] w-full text-sm font-semibold text-ink-2">
          Back
        </button>
      </LobbyCard>
    )
  }

  return (
    <LobbyCard icon={<Link2 className="h-7 w-7" aria-hidden />} title="Join a game" blurb="Type the 6-character code your friend shared.">
      {needsNickname && <NameField id={nameId} value={nickname} onChange={setNickname} />}

      <label htmlFor={codeId} className="block text-left text-xs font-semibold text-ink-2">
        Invite code
      </label>
      <input
        id={codeId}
        type="text"
        inputMode="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="ABC123"
        maxLength={6}
        autoCapitalize="characters"
        autoComplete="off"
        className="min-h-[56px] w-full rounded-xl border border-black/15 bg-background px-4 text-center font-mono text-2xl font-bold tracking-[0.35em] text-ink placeholder:text-black/25 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />

      <ErrorLine message={error} />

      <button
        onClick={joinGame}
        disabled={busy || code.trim().length !== 6}
        className="min-h-[48px] w-full rounded-xl bg-brand-600 px-4 font-heading font-bold text-white transition-colors hover:bg-brand-700 disabled:bg-black/10 disabled:text-muted"
      >
        {busy ? (
          <span className="inline-flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> Joining…
          </span>
        ) : 'Join game'}
      </button>
      <button
        onClick={() => { setSubMode('choose'); setError(null) }}
        disabled={busy}
        className="min-h-[48px] w-full text-sm font-semibold text-ink-2"
      >
        Back
      </button>
    </LobbyCard>
  )
}

function LobbyCard({
  icon, title, blurb, children,
}: {
  icon: React.ReactNode
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-black/[0.07] bg-surface p-5 text-center shadow-sm">
      <span className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-700">
        {icon}
      </span>
      <h2 className="font-heading text-xl font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mx-auto max-w-[34ch] text-pretty pb-1 text-sm text-ink-2">{blurb}</p>
      {children}
    </div>
  )
}

/** A visible label, not a placeholder standing in for one — a placeholder
 *  vanishes the moment a child starts typing, and is invisible to some
 *  screen readers. */
function NameField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <label htmlFor={id} className="block text-left text-xs font-semibold text-ink-2">
        Your name
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={20}
        autoComplete="off"
        className="min-h-[48px] w-full rounded-xl border border-black/15 bg-background px-4 text-center font-semibold text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
    </>
  )
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm font-semibold text-[color:var(--game-danger)]">
      {message}
    </p>
  )
}
