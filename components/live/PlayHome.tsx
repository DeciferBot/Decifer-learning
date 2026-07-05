'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Swords, Users, ArrowRight, Zap, Clock, Target } from '@/components/ui/icons'

export type HostSubject = {
  id: string
  name: string
  slug: string | null
  colourToken: string
  topics: { id: string; title: string }[]
}

export type YearGroupOption = {
  id: string
  label: string
  subjects: HostSubject[]
}

type Tab = 'host' | 'join'
type Mode = 'topic' | 'subject'

const QUESTION_COUNTS = [5, 10, 15] as const
const SECONDS = [10, 15, 20, 30] as const

// DB year-group labels are slugs ("year-3"); show them as "Year 3".
function prettyYear(label: string): string {
  const n = label.replace(/\D/g, '')
  return n ? `Year ${n}` : label
}

export function PlayHome({
  yearGroupOptions,
  yearGroupId,
  isLoggedIn,
}: {
  yearGroupOptions: YearGroupOption[]
  yearGroupId: string | null
  isLoggedIn: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('host')

  return (
    <div className="mx-auto max-w-md">
      <header className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600">
          <Swords className="h-4 w-4" /> Decifer Blitz
        </div>
        <h1 className="font-heading text-2xl font-extrabold text-ink">Quiz battle!</h1>
        <p className="mt-1 text-sm text-muted">
          Host a game on one device, then everyone joins with the code.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface p-1 shadow-sm ring-1 ring-black/5">
        {(['host', 'join'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
              tab === t ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {t === 'host' ? <Zap className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {t === 'host' ? 'Host a game' : 'Join a game'}
          </button>
        ))}
      </div>

      {tab === 'host' ? (
        <HostForm
          yearGroupOptions={yearGroupOptions}
          initialYearGroupId={yearGroupId}
          isLoggedIn={isLoggedIn}
          onCreated={(id) => router.push(`/live/${id}`)}
        />
      ) : (
        <JoinForm onJoined={(id) => router.push(`/live/${id}`)} />
      )}
    </div>
  )
}

function HostForm({
  yearGroupOptions,
  initialYearGroupId,
  isLoggedIn,
  onCreated,
}: {
  yearGroupOptions: YearGroupOption[]
  initialYearGroupId: string | null
  isLoggedIn: boolean
  onCreated: (gameId: string) => void
}) {
  const defaultYgId = initialYearGroupId ?? yearGroupOptions[0]?.id ?? ''
  const [selectedYgId, setSelectedYgId] = useState(defaultYgId)

  const subjects = useMemo(
    () => yearGroupOptions.find((yg) => yg.id === selectedYgId)?.subjects ?? [],
    [yearGroupOptions, selectedYgId],
  )

  const [mode, setMode] = useState<Mode>('topic')
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId])
  const [topicId, setTopicId] = useState(subject?.topics[0]?.id ?? '')
  const selectedTopicTitle = subject?.topics.find((t) => t.id === topicId)?.title
  const [count, setCount] = useState<number>(10)
  const [seconds, setSeconds] = useState<number>(20)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onPickYearGroup(id: string) {
    setSelectedYgId(id)
    const yg = yearGroupOptions.find((y) => y.id === id)
    const firstSubject = yg?.subjects[0]
    setSubjectId(firstSubject?.id ?? '')
    setTopicId(firstSubject?.topics[0]?.id ?? '')
  }

  function onPickSubject(id: string) {
    setSubjectId(id)
    const next = subjects.find((s) => s.id === id)
    setTopicId(next?.topics[0]?.id ?? '')
  }

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/live/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          subjectId,
          topicId: mode === 'topic' ? topicId : undefined,
          yearGroupId: selectedYgId,
          questionCount: count,
          secondsPerQuestion: seconds,
          email: isLoggedIn ? undefined : email.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.error === 'not_enough_questions'
            ? 'Not enough questions here yet. Try another topic or a mixed blast.'
            : data.error === 'valid_email_required'
              ? 'Enter a valid email address to host.'
              : 'Could not start the game. Try again.',
        )
        return
      }
      onCreated(data.gameId)
    } catch {
      setError('Network problem. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (yearGroupOptions.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-6 text-center text-sm text-muted shadow-sm ring-1 ring-black/5">
        No live-ready quizzes available yet. Check back soon!
      </div>
    )
  }

  const canCreate =
    !busy &&
    (mode === 'subject' || !!topicId) &&
    (isLoggedIn || email.includes('@'))

  return (
    <div className="space-y-5 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
      {/* Email — guests only */}
      {!isLoggedIn && (
        <Field label="Your email">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-base text-ink placeholder:text-muted/50"
          />
          <p className="mt-1.5 text-xs text-muted">No account needed, we just need your email.</p>
        </Field>
      )}

      {/* Year group — shown for guests (logged-in users get theirs pre-set) */}
      {!initialYearGroupId && (
        <Field label="Year group">
          <div className="flex flex-wrap gap-2">
            {yearGroupOptions.map((yg) => (
              <button
                key={yg.id}
                onClick={() => onPickYearGroup(yg.id)}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                  selectedYgId === yg.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-background text-ink hover:opacity-90'
                }`}
              >
                {prettyYear(yg.label)}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="What to play">
        <div className="grid grid-cols-2 gap-2">
          <Chip active={mode === 'topic'} onClick={() => setMode('topic')} icon={<Target className="h-4 w-4" />}>
            One topic
          </Chip>
          <Chip active={mode === 'subject'} onClick={() => setMode('subject')} icon={<Zap className="h-4 w-4" />}>
            Mixed blast
          </Chip>
        </div>
      </Field>

      <Field label="Subject">
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => onPickSubject(s.id)}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                subjectId === s.id ? 'text-white shadow-sm' : 'bg-background text-ink hover:opacity-90'
              }`}
              style={subjectId === s.id ? { backgroundColor: s.colourToken } : undefined}
            >
              {s.name}
            </button>
          ))}
        </div>
      </Field>

      {mode === 'topic' && subject ? (
        <Field label="Topic">
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-background px-3 py-3 text-sm font-semibold text-ink"
          >
            {subject.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Questions">
        <div className="grid grid-cols-3 gap-2">
          {QUESTION_COUNTS.map((n) => (
            <Chip key={n} active={count === n} onClick={() => setCount(n)}>
              {n}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Seconds per question">
        <div className="grid grid-cols-4 gap-2">
          {SECONDS.map((n) => (
            <Chip key={n} active={seconds === n} onClick={() => setSeconds(n)} icon={<Clock className="h-3.5 w-3.5" />}>
              {n}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Confirm exactly what will be hosted — so the subject can never be
          wrong without the host seeing it before they tap Create. */}
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
        style={{
          backgroundColor: subject ? `${subject.colourToken}1A` : 'rgba(0,0,0,0.04)',
        }}
      >
        {subject ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.colourToken }} />
        ) : null}
        <span className="text-muted">Hosting:</span>
        <span className="font-bold text-ink">
          {subject?.name ?? 'pick a subject'}
          {subject
            ? mode === 'subject'
              ? ' · Mixed blast'
              : selectedTopicTitle
                ? ` · ${selectedTopicTitle}`
                : ''
            : ''}
        </span>
      </div>

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={!canCreate}
        onClick={create}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-heading text-base font-extrabold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Setting up…' : subject ? `Create ${subject.name} game` : 'Create game'}{' '}
        <ArrowRight className="h-5 w-5" />
      </motion.button>
    </div>
  )
}

function JoinForm({ onJoined }: { onJoined: (gameId: string) => void }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/live/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.error === 'game_not_found'
            ? "That code didn't match a game. Check the digits!"
            : data.error === 'game_already_started'
              ? 'That game already started.'
              : 'Enter the 6-digit code.',
        )
        return
      }
      onJoined(data.gameId)
    } catch {
      setError('Network problem. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
      <Field label="Game code">
        <input
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full rounded-xl border border-black/10 bg-background py-4 text-center font-mono text-3xl font-bold tracking-[0.4em] text-ink placeholder:text-muted/40"
        />
      </Field>
      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={busy || pin.length !== 6}
        onClick={join}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-heading text-base font-extrabold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Joining…' : 'Join game'} <ArrowRight className="h-5 w-5" />
      </motion.button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold transition ${
        active ? 'bg-brand text-white shadow-sm' : 'bg-background text-ink hover:opacity-90'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
