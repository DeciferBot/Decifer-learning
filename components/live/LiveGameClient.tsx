'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveGame, type LivePlayer } from '@/lib/live/useLiveGame'
import { AnswerTiles } from './AnswerTiles'
import { Users, Crown, Trophy, Medal, Zap, ArrowRight, Clock, Star } from '@/components/ui/icons'

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

export function LiveGameClient({
  gameId,
  myPlayerId,
  isHost,
}: {
  gameId: string
  myPlayerId: string
  isHost: boolean
}) {
  const { game, players, ready } = useLiveGame(gameId)

  if (!ready || !game) {
    return <div className="py-20 text-center text-sm text-muted">Loading game…</div>
  }

  if (game.status === 'lobby') {
    return <Lobby gameId={gameId} pin={game.pin} players={players} isHost={isHost} />
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

// ---------- Lobby ----------
function Lobby({
  gameId,
  pin,
  players,
  isHost,
}: {
  gameId: string
  pin: string
  players: LivePlayer[]
  isHost: boolean
}) {
  const [busy, setBusy] = useState(false)
  async function start() {
    setBusy(true)
    await fetch(`/api/live/${gameId}/start`, { method: 'POST' })
    // Realtime flips everyone to the first question; no local nav needed.
  }
  const joinUrl =
    typeof window !== 'undefined' ? `${window.location.host}/join` : 'this site → Join'
  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Game code</p>
      <div className="my-3 rounded-3xl bg-surface px-6 py-6 shadow-sm ring-1 ring-black/5">
        <p className="font-mono text-5xl font-extrabold tracking-[0.3em] text-ink">{pin}</p>
      </div>
      <p className="mb-6 text-sm text-muted">
        Friends join at <span className="font-bold text-ink">{joinUrl}</span> — no account needed.
      </p>

      <div className="mb-6 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-center gap-2 text-sm font-bold text-ink">
          <Users className="h-4 w-4" /> {players.length} {players.length === 1 ? 'player' : 'players'}
        </div>
        <ul className="flex flex-wrap justify-center gap-2">
          <AnimatePresence>
            {players.map((p) => (
              <motion.li
                key={p.id}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-sm font-semibold text-ink"
              >
                {p.is_host ? <Crown className="h-3.5 w-3.5 text-points-gold" /> : null}
                {p.display_name}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {isHost ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={busy}
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-heading text-base font-extrabold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Starting…' : 'Start game'} <Zap className="h-5 w-5" />
        </motion.button>
      ) : (
        <p className="animate-pulse text-sm font-semibold text-muted">Waiting for the host to start…</p>
      )}
    </div>
  )
}

// ---------- In-question ----------
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
    return <div className="py-20 text-center text-sm text-muted">Loading question…</div>
  }

  const secondsLeft = Math.ceil(remainingMs / 1000)
  const pct = Math.max(0, Math.min(100, (remainingMs / (payload.secondsPerQuestion * 1000)) * 100))
  const locked = result !== null || remainingMs <= 0
  const isLast = index >= total - 1

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <div className="mb-2 flex items-center justify-between text-sm font-bold text-muted">
        <span>
          Question {index + 1} / {total}
        </span>
        <span className="flex items-center gap-3 text-ink">
          {isHost && tally ? (
            <span className="flex items-center gap-1 text-muted">
              <Users className="h-4 w-4" /> {tally.answered}/{tally.total}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" /> {secondsLeft}s
          </span>
        </span>
      </div>
      {/* Countdown bar */}
      <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%`, backgroundColor: pct > 30 ? '#52D9A0' : '#FF6B6B' }}
        />
      </div>

      <div className="mb-6 rounded-2xl bg-surface p-6 text-center shadow-sm ring-1 ring-black/5">
        <h2 className="font-heading text-xl font-extrabold leading-snug text-ink">{payload.questionText}</h2>
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
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`mt-5 rounded-2xl p-4 text-center font-heading text-lg font-extrabold ${
              result.correct ? 'bg-correct/15 text-correct' : 'bg-rose/15 text-rose-700'
            }`}
          >
            {result.correct ? `Correct! +${result.points}` : selected ? 'Not quite!' : "Time's up!"}
          </motion.div>
        ) : locked ? (
          <p className="mt-5 text-center text-sm font-semibold text-muted">Locked in — waiting…</p>
        ) : null}
      </AnimatePresence>

      {/* Host-only: answer distribution, revealed once the timer is up */}
      {isHost && locked && tally ? (
        <AnswerDistribution choices={payload.choices} tally={tally} />
      ) : null}

      {/* Mini live standings */}
      <MiniBoard players={players} myPlayerId={myPlayerId} />

      {isHost ? (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-2xl px-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={advancing}
            onClick={next}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-4 font-heading text-base font-extrabold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {isLast ? 'Show results' : 'Next question'} <ArrowRight className="h-5 w-5" />
          </motion.button>
        </div>
      ) : null}
    </div>
  )
}

// Host reveal: a Kahoot-style bar of how many players chose each option, with
// the correct tile highlighted.
const TILE_COLOURS = ['#FF6B6B', '#6C9EFF', '#FFD43B', '#52D9A0']
function AnswerDistribution({ choices, tally }: { choices: string[]; tally: Tally }) {
  const max = Math.max(1, ...choices.map((c) => tally.distribution[c] ?? 0))
  const norm = (s: string) => s.trim().toLowerCase()
  return (
    <div className="mt-5 space-y-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Answers</p>
      {choices.map((c, i) => {
        const count = tally.distribution[c] ?? 0
        const isCorrect = tally.correctAnswer !== null && norm(c) === norm(tally.correctAnswer)
        return (
          <div key={`${c}-${i}`} className="flex items-center gap-2">
            <span aria-hidden className="text-lg" style={{ color: TILE_COLOURS[i % 4] }}>
              {['▲', '◆', '●', '■'][i % 4]}
            </span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-background">
              <div
                className="h-full rounded-lg transition-all"
                style={{
                  width: `${(count / max) * 100}%`,
                  backgroundColor: isCorrect ? '#29D17C' : TILE_COLOURS[i % 4],
                  opacity: isCorrect ? 1 : 0.55,
                }}
              />
              <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-ink">
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
    <div className="mt-6 space-y-1.5">
      {top.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
            p.id === myPlayerId ? 'bg-brand-50 font-bold text-ink' : 'bg-surface text-ink'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="w-5 text-muted">{i + 1}.</span>
            {p.display_name}
          </span>
          <span className="font-mono font-bold">{p.score}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- Podium ----------
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
  const medalColour = ['#F5A524', '#9CA3AF', '#CD7F32']

  return (
    <div className="mx-auto max-w-md text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-2 inline-flex items-center gap-2 rounded-full bg-points-gold/15 px-4 py-1.5 font-heading font-extrabold text-points-gold-700"
      >
        <Trophy className="h-5 w-5" /> Final scores
      </motion.div>

      {me ? (
        <p className="mb-6 text-sm font-semibold text-muted">
          You finished {ordinal(myRank + 1)} with <span className="font-bold text-ink">{me.score}</span> points!
        </p>
      ) : null}

      <ol className="mb-8 space-y-2 text-left">
        {sorted.map((p, i) => (
          <motion.li
            key={p.id}
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 shadow-sm ring-1 ring-black/5 ${
              p.id === myPlayerId ? 'bg-brand-50' : 'bg-surface'
            }`}
          >
            <span className="flex items-center gap-3 font-heading font-bold text-ink">
              {i < 3 ? (
                <Medal className="h-5 w-5" style={{ color: medalColour[i] }} />
              ) : (
                <span className="w-5 text-center text-muted">{i + 1}</span>
              )}
              {p.display_name}
            </span>
            <span className="flex items-center gap-1 font-mono font-extrabold text-ink">
              <Star className="h-4 w-4 text-points-gold" />
              {p.score}
            </span>
          </motion.li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        {isHost ? (
          <>
            <Link
              href="/play"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-heading text-base font-extrabold text-white shadow-sm transition hover:opacity-90"
            >
              Play again <Zap className="h-5 w-5" />
            </Link>
            <Link
              href="/dashboard/child"
              className="w-full rounded-2xl bg-surface py-4 font-heading text-base font-bold text-ink shadow-sm ring-1 ring-black/5 transition hover:bg-background"
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
