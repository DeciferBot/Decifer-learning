'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// The check itself: twenty questions, one at a time, no timer and no score on
// screen.
//
// Deliberately unlike the quiz. No hearts, no points, no streak, no buddy. A
// check is not a game, and a child who is being measured should not also be
// being scored at. The only feedback is the progress bar.
//
// All twenty answers are submitted together at the end. Marking is server-side,
// so nothing here knows which option is right.

type Question = {
  itemId: string
  position: number
  questionText: string
  options: string[]
}

type Props = {
  subject: string
  year: string
  yearLabel: string
  subjectName: string
  itemCount: number
}

type Phase = 'idle' | 'loading' | 'running' | 'submitting' | 'error'

export function CheckRunner({ subject, year, yearLabel, subjectName, itemCount }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const startedAt = useRef<number>(0)
  const questionShownAt = useRef<number>(0)
  const times = useRef<Record<string, number>>({})
  const headingRef = useRef<HTMLHeadingElement>(null)

  const start = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch('/api/skills-check/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, year }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not start the check.')
      setToken(data.token)
      setQuestions(data.questions ?? [])
      setIndex(0)
      setAnswers({})
      startedAt.current = Date.now()
      questionShownAt.current = Date.now()
      setPhase('running')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the check.')
      setPhase('error')
    }
  }, [subject, year])

  // Move focus to the question when it changes, so a screen reader announces the
  // new question instead of leaving the user on a button that has moved on.
  useEffect(() => {
    if (phase === 'running') headingRef.current?.focus()
  }, [phase, index])

  const current = questions[index]
  const answeredCount = Object.keys(answers).length

  const choose = (option: string) => {
    if (!current) return
    times.current[current.itemId] = Math.round((Date.now() - questionShownAt.current) / 1000)
    setAnswers((prev) => ({ ...prev, [current.itemId]: option }))
  }

  const goNext = () => {
    questionShownAt.current = Date.now()
    setIndex((i) => Math.min(i + 1, questions.length - 1))
  }

  const goBack = () => {
    questionShownAt.current = Date.now()
    setIndex((i) => Math.max(i - 1, 0))
  }

  const submit = async () => {
    if (!token) return
    setPhase('submitting')
    setError(null)
    try {
      const res = await fetch('/api/skills-check/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          answers: questions.map((q) => ({
            itemId: q.itemId,
            answer: answers[q.itemId] ?? null,
            timeSeconds: times.current[q.itemId],
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not save the answers.')
      router.push(`/skills-check/r/${data.token}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the answers.')
      setPhase('error')
    }
  }

  if (phase === 'idle' || phase === 'error') {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-5">
        {error && (
          <p role="alert" className="mb-3 text-sm font-medium text-error">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
        >
          {phase === 'error' ? 'Try again' : `Start the ${yearLabel} ${subjectName} check`}
        </button>
        <p className="mt-3 text-sm text-ink-2">
          {itemCount} questions. No account, no timer. You can stop at any point.
        </p>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-5">
        <p className="text-[15px] text-ink-2">Getting the questions ready…</p>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-5">
        <p className="text-[15px] text-ink-2">This check has no questions yet.</p>
      </div>
    )
  }

  const isLast = index === questions.length - 1
  const allAnswered = answeredCount === questions.length
  const chosen = answers[current.itemId]

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-5">
      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-2">
            Question {index + 1} of {questions.length}
          </span>
          <span className="font-mono text-xs text-ink-2">{answeredCount} answered</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-black/5"
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-label="Questions answered"
        >
          <div
            className="h-full rounded-full bg-ember transition-[width] duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mb-4 text-lg font-semibold leading-snug text-ink outline-none"
      >
        {current.questionText}
      </h2>

      <div role="group" aria-label="Answer options" className="space-y-2">
        {current.options.map((option) => {
          const selected = chosen === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(option)}
              className={`flex min-h-[48px] w-full items-center rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${
                selected
                  ? 'border-ember bg-brand-50 font-semibold text-ink'
                  : 'border-black/10 bg-background text-ink hover:border-ember/40'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={index === 0}
          className="inline-flex min-h-[48px] items-center rounded-xl px-4 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5 disabled:opacity-40"
        >
          Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={phase === 'submitting'}
            className="inline-flex min-h-[48px] items-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {phase === 'submitting' ? 'Marking…' : 'Finish and see the result'}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex min-h-[48px] items-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Next
          </button>
        )}
      </div>

      {isLast && !allAnswered && (
        <p className="mt-3 text-sm text-ink-2">
          {questions.length - answeredCount} still blank. You can finish anyway, but a blank
          counts as wrong.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  )
}
