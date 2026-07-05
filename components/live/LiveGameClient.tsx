'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveGame, type LivePlayer } from '@/lib/live/useLiveGame'
import { AnswerTiles } from './AnswerTiles'
import { Users, Crown, Trophy, Zap, ArrowRight, Check, Link2 } from '@/components/ui/icons'

type QuestionPayload = {
  index: number
  total: number
  tier: string
  questionText: string
  choices: string[]
  secondsPerQuestion: number
  startedAt: number
  endsAt: number
}

type AnswerResult = { correct: boolean; points: number; correctAnswer: string }
type Tally = {
  index: number
  total: number
  answered: number
  distribution: Record<string, number>
  correctAnswer: string | null
}

// ── shared bits ──────────────────────────────────────────────────────────────

// Deterministic colour for a player's avatar from their id.
const AVATAR_COLOURS = ['#F0506E', '#4C8DFF', '#FFC53D', '#2FBF87', '#B197FC', '#FF922B']
function avatarColour(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLOURS[Math.abs(h) % AVATAR_COLOURS.length]
}
function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}

function Avatar({ name, id, size = 36 }: { name: string; id: string; size?: number }) {
  const bg = avatarColour(id)
  const dark = bg === '#FFC53D'
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-heading font-extrabold"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: dark ? '#3A2E00' : '#fff',
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

const TIER_LABEL: Record<string, string> = {
  sprout: 'Sprout',
  explorer: 'Explorer',
  lightning: 'Lightning',
}

// ── root ─────────────────────────────────────────────────────────────────────

export function LiveGameClient({
  gameId,
  myPlayerId,
  isHost,
  scopeLabel,
}: {
  gameId: string
  myPlayerId: string
  isHost: boolean
  scopeLabel?: string | null
}) {
  const { game, players, ready } = useLiveGame(gameId)

  if (!ready || !game) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand/30 border-t-brand" />
        <p className="text-sm font-semibold text-muted">Loading game…</p>
      </div>
    )
  }

  if (game.status === 'lobby') {
    return <Lobby gameId={gameId} pin={game.pin} players={players} isHost={isHost} scopeLabel={scopeLabel} />
  }
  if (game.status === 'finished') {
    return <Podium players={players} myPlayerId={myPlayerId} isHost={isHost} />
  }
  return (
    <QuestionView
      gameId={gameId}
      index={game.current_index}
      isHost={isHost}
      total={game.question_count}
      players={players}
      myPlayerId={myPlayerId}
    />
  )
}

// ── Lobby ────────────────────────────────────────────────────────────────────

function Lobby({
  gameId,
  pin,
  players,
  isHost,
  scopeLabel,
}: {
  gameId: string
  pin: string
  players: LivePlayer[]
  isHost: boolean
  scopeLabel?: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function start() {
    setBusy(true)
    await fetch(`/api/live/${gameId}/start`, { method: 'POST' })
    // Realtime flips everyone to the first question; no local nav needed.
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const joinHost = typeof window !== 'undefined' ? window.location.host : 'deciferlearning.com'
  const joinUrl = `${origin}/join?pin=${pin}`

  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Decifer Blitz', text: `Join my quiz battle! Code: ${pin}`, url: joinUrl })
        return
      } catch {
        // user cancelled or API unavailable — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // clipboard blocked — nothing to do
    }
  }

  return (
    <div className="mx-auto max-w-md">
      {/* PIN hero */}
      <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-8 text-center shadow-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-2xl"
          style={{ background: 'radial-gradient(circle, var(--brand), transparent 70%)' }}
        />
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-surface/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          Game code
        </div>
        <p className="font-mono text-6xl font-extrabold leading-none tracking-[0.18em] text-white">
          {pin}
        </p>

        {scopeLabel ? (
          <p className="mt-3 inline-block rounded-full bg-surface/10 px-3 py-1 text-sm font-bold text-white">
            {scopeLabel}
          </p>
        ) : null}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={share}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-heading text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-700"
        >
          {copied ? (
            <><Check className="h-4 w-4" /> Link copied!</>
          ) : (
            <><Link2 className="h-4 w-4" /> Share join link</>
          )}
        </motion.button>
        <p className="mt-3 text-xs text-white/50">
          Or open <span className="font-semibold text-white/80">{joinHost}/join</span> and enter the code
        </p>
      </div>

      {/* Players */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-base font-extrabold text-ink">
            <Users className="h-4 w-4 text-muted" /> Players
          </h2>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 font-mono text-sm font-bold text-brand-600">
            {players.length}
          </span>
        </div>

        {players.length === 0 ? (
          <p className="rounded-2xl bg-surface py-8 text-center text-sm text-muted shadow-sm ring-1 ring-black/5">
            Waiting for players to join…
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            <AnimatePresence>
              {players.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  className="flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-2.5 shadow-sm ring-1 ring-black/5"
                >
                  <Avatar name={p.display_name} id={p.id} size={32} />
                  <span className="flex-1 truncate text-sm font-bold text-ink">{p.display_name}</span>
                  {p.is_host ? <Crown className="h-4 w-4 shrink-0 text-points-gold" /> : null}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Action */}
      <div className="mt-7">
        {isHost ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={busy || players.length === 0}
            onClick={start}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-heading text-base font-extrabold text-white shadow-md transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Starting…' : players.length === 0 ? 'Waiting for players…' : 'Start game'}
            {!busy && players.length > 0 ? <Zap className="h-5 w-5" /> : null}
          </motion.button>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-surface py-4 text-sm font-semibold text-muted shadow-sm ring-1 ring-black/5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            Waiting for the host to start…
          </p>
        )}
      </div>
    </div>
  )
}

// ── Circular countdown ───────────────────────────────────────────────────────

function TimerRing({ secondsLeft, pct }: { secondsLeft: number; pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const colour = pct > 50 ? '#2FBF87' : pct > 20 ? '#FFC53D' : '#F0506E'
  const low = pct <= 20
  return (
    <div className={`relative h-16 w-16 ${low ? 'animate-pulse' : ''}`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#00000010" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center font-mono text-xl font-extrabold"
        style={{ color: colour }}
      >
        {secondsLeft}
      </span>
    </div>
  )
}

// ── In-question ──────────────────────────────────────────────────────────────

function QuestionView({
  gameId,
  index,
  total,
  isHost,
  players,
  myPlayerId,
}: {
  gameId: string
  index: number
  total: number
  isHost: boolean
  players: LivePlayer[]
  myPlayerId: string
}) {
  const [payload, setPayload] = useState<QuestionPayload | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [remainingMs, setRemainingMs] = useState<number>(0)
  const [advancing, setAdvancing] = useState(false)
  const [tally, setTally] = useState<Tally | null>(null)
  const lockedRef = useRef(false) // guards double submit (pick or timeout)

  // Fetch the question payload whenever the question index changes.
  useEffect(() => {
    let active = true
    setPayload(null)
    setSelected(null)
    setResult(null)
    setTally(null)
    lockedRef.current = false
    fetch(`/api/live/${gameId}/question?index=${index}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d && typeof d.index === 'number') setPayload(d as QuestionPayload)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [gameId, index])

  const submit = useCallback(
    async (choice: string | null) => {
      if (lockedRef.current) return
      lockedRef.current = true
      if (choice) setSelected(choice)
      try {
        const res = await fetch(`/api/live/${gameId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, answer: choice ?? '', timedOut: choice === null }),
        })
        const d = await res.json()
        if (res.ok) setResult(d as AnswerResult)
      } catch {
        lockedRef.current = false // allow retry on network failure
      }
    },
    [gameId, index],
  )

  // Countdown tick + auto-submit a timeout reveal when the clock runs out.
  useEffect(() => {
    if (!payload) return
    const tick = () => {
      const left = payload.endsAt - Date.now()
      setRemainingMs(Math.max(0, left))
      if (left <= 0 && !lockedRef.current) submit(null)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [payload, submit])

  // Host presenter: poll the live answer tally (count + distribution) so the
  // host can see who has answered and reveal the spread. Players don't poll.
  useEffect(() => {
    if (!isHost) return
    let active = true
    const poll = () =>
      fetch(`/api/live/${gameId}/tally`)
        .then((r) => r.json())
        .then((d) => {
          if (active && d && typeof d.answered === 'number') setTally(d as Tally)
        })
        .catch(() => {})
    poll()
    const id = setInterval(poll, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [isHost, gameId, index])

  async function next() {
    setAdvancing(true)
    await fetch(`/api/live/${gameId}/next`, { method: 'POST' })
    setAdvancing(false)
  }

  if (!payload) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand/30 border-t-brand" />
        <p className="text-sm font-semibold text-muted">Loading question…</p>
      </div>
    )
  }

  const secondsLeft = Math.ceil(remainingMs / 1000)
  const pct = Math.max(0, Math.min(100, (remainingMs / (payload.secondsPerQuestion * 1000)) * 100))
  const locked = result !== null || remainingMs <= 0
  const isLast = index >= total - 1

  return (
    <div className="mx-auto max-w-2xl pb-28">
      {/* Header: progress + tier + timer */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">
            Question {index + 1} / {total}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600">
              {TIER_LABEL[payload.tier] ?? payload.tier}
            </span>
            {isHost && tally ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                <Users className="h-3.5 w-3.5" /> {tally.answered}/{tally.total} answered
              </span>
            ) : null}
          </div>
        </div>
        <TimerRing secondsLeft={secondsLeft} pct={pct} />
      </div>

      {/* Question */}
      <div className="mb-6 rounded-3xl bg-surface p-7 text-center shadow-sm ring-1 ring-black/5">
        <h2 className="font-heading text-2xl font-extrabold leading-snug text-ink">{payload.questionText}</h2>
      </div>

      <AnswerTiles
        choices={payload.choices}
        disabled={locked}
        selected={selected}
        correctAnswer={result?.correctAnswer ?? null}
        onPick={(c) => submit(c)}
      />

      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ y: 12, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className={`mt-5 flex items-center justify-center gap-2 rounded-2xl p-4 text-center font-heading text-lg font-extrabold ${
              result.correct ? 'bg-correct/15 text-correct' : 'bg-rose/15 text-rose-700'
            }`}
          >
            {result.correct ? (
              <>
                <Check className="h-6 w-6" /> Correct!{' '}
                <span className="font-mono">+{result.points}</span>
              </>
            ) : selected ? (
              'Not quite!'
            ) : (
              "Time's up!"
            )}
          </motion.div>
        ) : locked ? (
          <p className="mt-5 text-center text-sm font-semibold text-muted">Locked in, waiting for others…</p>
        ) : null}
      </AnimatePresence>

      {/* Host-only: answer distribution, revealed once the timer is up */}
      {isHost && locked && tally ? (
        <AnswerDistribution choices={payload.choices} tally={tally} />
      ) : null}

      {/* Mini live standings */}
      <MiniBoard players={players} myPlayerId={myPlayerId} />

      {isHost ? (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-2xl px-4 pb-5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={advancing}
            onClick={next}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-4 font-heading text-base font-extrabold text-white shadow-xl transition hover:opacity-90 disabled:opacity-50"
          >
            {isLast ? 'Show final results' : 'Next question'} <ArrowRight className="h-5 w-5" />
          </motion.button>
        </div>
      ) : null}
    </div>
  )
}

// Host reveal: a Kahoot-style bar of how many players chose each option, with
// the correct tile highlighted.
const TILE_COLOURS = ['#F0506E', '#4C8DFF', '#FFC53D', '#2FBF87']
function AnswerDistribution({ choices, tally }: { choices: string[]; tally: Tally }) {
  const max = Math.max(1, ...choices.map((c) => tally.distribution[c] ?? 0))
  const norm = (s: string) => s.trim().toLowerCase()
  return (
    <div className="mt-5 space-y-2.5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">Answer spread</p>
      {choices.map((c, i) => {
        const count = tally.distribution[c] ?? 0
        const isCorrect = tally.correctAnswer !== null && norm(c) === norm(tally.correctAnswer)
        return (
          <div key={`${c}-${i}`} className="flex items-center gap-2.5">
            <span aria-hidden className="text-lg" style={{ color: TILE_COLOURS[i % 4] }}>
              {['▲', '◆', '●', '■'][i % 4]}
            </span>
            <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-background">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-lg"
                style={{
                  backgroundColor: isCorrect ? '#2FBF87' : TILE_COLOURS[i % 4],
                  opacity: isCorrect ? 1 : 0.5,
                }}
              />
              <span className="absolute inset-y-0 left-2.5 flex items-center text-xs font-bold text-ink">
                {c} {isCorrect ? '✓' : ''}
              </span>
            </div>
            <span className="w-6 text-right font-mono text-sm font-bold text-ink">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function MiniBoard({ players, myPlayerId }: { players: LivePlayer[]; myPlayerId: string }) {
  const top = players.slice(0, 4)
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Standings</p>
      <div className="space-y-1.5">
        {top.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 ${
              p.id === myPlayerId ? 'bg-brand-50 ring-brand/15' : 'bg-surface'
            }`}
          >
            <span className="w-5 text-center font-mono font-bold text-muted">{i + 1}</span>
            <Avatar name={p.display_name} id={p.id} size={26} />
            <span className="flex-1 truncate font-bold text-ink">{p.display_name}</span>
            <span className="font-mono font-extrabold text-ink">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Podium ───────────────────────────────────────────────────────────────────
// Top 3 on pedestals, then a ranked list. Players outside the visible top see
// their own row pinned below.
const PODIUM_VISIBLE = 20

function Podium({
  players,
  myPlayerId,
  isHost,
}: {
  players: LivePlayer[]
  myPlayerId: string
  isHost: boolean
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const myRank = sorted.findIndex((p) => p.id === myPlayerId)
  const me = sorted[myRank]
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3, PODIUM_VISIBLE)
  const myRowVisible = myRank < PODIUM_VISIBLE

  // Pedestal display order: 2nd, 1st, 3rd
  const pedestalOrder = [top3[1], top3[0], top3[2]].filter(Boolean)
  const heights: Record<string, string> = {}
  if (top3[0]) heights[top3[0].id] = 'h-28'
  if (top3[1]) heights[top3[1].id] = 'h-20'
  if (top3[2]) heights[top3[2].id] = 'h-16'
  const medal: Record<string, { ring: string; badge: string }> = {}
  if (top3[0]) medal[top3[0].id] = { ring: '#F5A524', badge: '🥇' }
  if (top3[1]) medal[top3[1].id] = { ring: '#9CA3AF', badge: '🥈' }
  if (top3[2]) medal[top3[2].id] = { ring: '#CD7F32', badge: '🥉' }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-2 inline-flex items-center gap-2 rounded-full bg-points-gold/15 px-4 py-1.5 font-heading font-extrabold text-points-gold-700"
        >
          <Trophy className="h-5 w-5" /> Final scores
        </motion.div>
        {me ? (
          <p className="mb-7 text-sm font-semibold text-muted">
            You finished{' '}
            <span className="font-extrabold text-ink">{ordinal(myRank + 1)}</span> with{' '}
            <span className="font-extrabold text-ink">{me.score}</span> points!
          </p>
        ) : (
          <div className="mb-7" />
        )}
      </div>

      {/* Pedestal */}
      {top3.length > 0 ? (
        <div className="mb-8 flex items-end justify-center gap-2.5">
          {pedestalOrder.map((p) => (
            <div key={p.id} className="flex w-1/3 flex-col items-center">
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="flex flex-col items-center"
              >
                <span className="mb-1 text-2xl" aria-hidden>{medal[p.id]?.badge}</span>
                <span
                  className="rounded-full p-0.5"
                  style={{ boxShadow: `0 0 0 3px ${medal[p.id]?.ring}` }}
                >
                  <Avatar name={p.display_name} id={p.id} size={44} />
                </span>
                <span className="mt-1.5 max-w-full truncate text-xs font-bold text-ink">{p.display_name}</span>
                <span className="font-mono text-sm font-extrabold text-ink">{p.score}</span>
              </motion.div>
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 22 }}
                style={{ transformOrigin: 'bottom' }}
                className={`mt-2 w-full rounded-t-xl ${heights[p.id]} ${
                  p.id === myPlayerId ? 'bg-brand/80' : 'bg-ink/10'
                }`}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Remaining ranks */}
      {rest.length > 0 ? (
        <ol className="mb-3 space-y-2">
          {rest.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-sm ring-1 ring-black/5 ${
                p.id === myPlayerId ? 'bg-brand-50 ring-brand/15' : 'bg-surface'
              }`}
            >
              <span className="w-5 text-center font-mono font-bold text-muted">{i + 4}</span>
              <Avatar name={p.display_name} id={p.id} size={30} />
              <span className="flex-1 truncate font-heading font-bold text-ink">{p.display_name}</span>
              <span className="font-mono font-extrabold text-ink">{p.score}</span>
            </motion.li>
          ))}
        </ol>
      ) : null}

      {sorted.length > PODIUM_VISIBLE && (
        <p className="mb-3 text-center text-xs text-muted">
          Showing top {PODIUM_VISIBLE} of {sorted.length} players
        </p>
      )}

      {/* Pin the current player's own row when they're outside the visible top */}
      {me && !myRowVisible && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-2.5 shadow-sm ring-1 ring-brand/20">
          <span className="w-5 text-center font-mono font-bold text-muted">{myRank + 1}</span>
          <Avatar name={me.display_name} id={me.id} size={30} />
          <span className="flex-1 truncate font-heading font-bold text-ink">
            {me.display_name} <span className="text-xs font-normal text-muted">(you)</span>
          </span>
          <span className="font-mono font-extrabold text-ink">{me.score}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-2">
        {isHost ? (
          <>
            <Link
              href="/play"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-heading text-base font-extrabold text-white shadow-md transition hover:bg-brand-700"
            >
              Play again <Zap className="h-5 w-5" />
            </Link>
            <Link
              href="/dashboard/child"
              className="w-full rounded-2xl bg-surface py-4 text-center font-heading text-base font-bold text-ink shadow-sm ring-1 ring-black/5 transition hover:bg-background"
            >
              Back home
            </Link>
          </>
        ) : (
          // Players (incl. logged-out guests) get a public exit, never a login wall.
          <Link
            href="/join"
            className="w-full rounded-2xl bg-surface py-4 text-center font-heading text-base font-bold text-ink shadow-sm ring-1 ring-black/5 transition hover:bg-background"
          >
            Leave game
          </Link>
        )}
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
