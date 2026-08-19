'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FigureCell, StimulusView, optionLabel } from '@/components/reasoning/Figures'
import { AGE_BANDS, AGE_BAND_LABELS, TOTAL_ITEMS, type AgeBand } from '@/lib/reasoning/plan'
import type { ReasoningQuestionView } from '@/lib/reasoning/server'

// The test itself: 24 questions, one at a time, adaptive.
//
// ONE AT A TIME BECAUSE IT HAS TO BE. The next question's difficulty is derived
// from the answers already given, so it cannot be fetched in advance. The
// upside is that nothing about the paper exists in the browser except the
// question on screen.
//
// SELECT, THEN CONFIRM. There is no going back in an adaptive test, so a single
// mis-tap would be permanent. Two taps per question is the cost of not doing
// that to a child.
//
// Deliberately unlike the quiz: no hearts, no points, no streak, no buddy, and
// no right/wrong feedback. A child being measured should not also be being
// scored at, and telling them they got one wrong is exactly how you make the
// next one worse.

type Phase = 'idle' | 'loading' | 'running' | 'finishing' | 'error'

/** Survives a reload so a refresh resumes rather than restarting. */
const TOKEN_KEY = 'decifer-reasoning-token'

export function ReasoningRunner() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ageBand, setAgeBand] = useState<AgeBand>('not_said')
  const [token, setToken] = useState<string | null>(null)
  const [question, setQuestion] = useState<ReasoningQuestionView | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const shownAt = useRef<number>(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const resumed = useRef(false)

  const finish = useCallback(
    (finishedToken: string) => {
      try {
        window.sessionStorage.removeItem(TOKEN_KEY)
      } catch {
        // Private mode and locked-down browsers throw here. Losing the resume
        // token is a small loss; failing the whole test over it is not.
      }
      router.push(`/reasoning/r/${finishedToken}`)
    },
    [router],
  )

  const show = useCallback((next: ReasoningQuestionView) => {
    setQuestion(next)
    setChosen(null)
    shownAt.current = Date.now()
    setPhase('running')
  }, [])

  const start = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch('/api/reasoning/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ageBand }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not start the test.')
      setToken(data.token)
      try {
        window.sessionStorage.setItem(TOKEN_KEY, data.token)
      } catch {
        // See above: no resume, but the test still works.
      }
      show(data.question)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the test.')
      setPhase('error')
    }
  }, [ageBand, show])

  // Resume an attempt left open in this tab. The server regenerates the same
  // question from the same seed, so a refresh mid-test does not reshuffle.
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    let saved: string | null = null
    try {
      saved = window.sessionStorage.getItem(TOKEN_KEY)
    } catch {
      saved = null
    }
    if (!saved) return
    setPhase('loading')
    void (async () => {
      try {
        const res = await fetch('/api/reasoning/next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: saved }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error('stale')
        setToken(saved)
        if (data.done) {
          finish(saved)
          return
        }
        show(data.question)
      } catch {
        try {
          window.sessionStorage.removeItem(TOKEN_KEY)
        } catch {
          /* nothing to clean up */
        }
        setPhase('idle')
      }
    })()
    // Runs once on mount, guarded by `resumed`. Listing `finish` and `show`
    // would re-run the resume on every render that changes them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move focus to the question when it changes, so a screen reader announces the
  // new one instead of leaving the user on a button that has moved on.
  useEffect(() => {
    if (phase === 'running') headingRef.current?.focus()
  }, [phase, question?.position])

  const answer = useCallback(
    async (index: number | null) => {
      if (!token || !question) return
      setPhase('finishing')
      setError(null)
      try {
        const res = await fetch('/api/reasoning/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            position: question.position,
            chosenIndex: index,
            timeMs: Date.now() - shownAt.current,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'Could not save that answer.')
        if (data.done) {
          finish(token)
          return
        }
        show(data.question)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save that answer.')
        setPhase('running')
      }
    },
    [token, question, finish, show],
  )

  if (phase === 'loading') {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-5">
        <p className="text-[15px] text-ink-2">Getting the first puzzle ready…</p>
      </div>
    )
  }

  if (phase === 'idle' || phase === 'error' || !question) {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-5">
        {error && (
          <p role="alert" className="mb-3 text-sm font-medium text-error">
            {error}
          </p>
        )}

        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-semibold text-ink">
            Which school year is your child in?
          </legend>
          <p className="mb-3 text-sm leading-relaxed text-ink-2">
            This does not change the questions. The test finds their level on its own. We ask so
            that, once enough children have taken it, we can say how a result compares with
            others the same age.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {AGE_BANDS.map((band) => (
              <label
                key={band}
                className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-colors ${
                  ageBand === band
                    ? 'border-ember bg-brand-50 font-semibold text-ink'
                    : 'border-black/10 bg-background text-ink hover:border-ember/40'
                }`}
              >
                {/* Explicit label as well as the wrapping one: without it the
                    accessibility tree fell back to the raw value, so a screen
                    reader read "year_3_4" instead of the words on screen. */}
                <input
                  type="radio"
                  name="age-band"
                  value={band}
                  aria-label={AGE_BAND_LABELS[band]}
                  checked={ageBand === band}
                  onChange={() => setAgeBand(band)}
                  className="h-5 w-5 accent-ember"
                />
                {AGE_BAND_LABELS[band]}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
        >
          {phase === 'error' ? 'Try again' : 'Start the reasoning test'}
        </button>
        <p className="mt-3 text-sm text-ink-2">
          {TOTAL_ITEMS} puzzles, about 12 minutes. No account, no timer on screen. Each puzzle
          gets a little harder when your child gets one right, and a little easier when they do
          not.
        </p>
      </div>
    )
  }

  const answered = question.position
  const busy = phase === 'finishing'
  const isLast = question.position === question.total - 1

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-5">
      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-2">
            Puzzle {question.position + 1} of {question.total}
          </span>
          <span className="font-mono text-xs text-ink-2">{question.typeLabel}</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-black/5"
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={question.total}
          aria-label="Puzzles answered"
        >
          <div
            className="h-full rounded-full bg-ember transition-[width] duration-300"
            style={{ width: `${(answered / question.total) * 100}%` }}
          />
        </div>
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mb-4 text-lg font-semibold leading-snug text-ink outline-none"
      >
        {question.prompt}
      </h2>

      <div className="mb-5">
        <StimulusView stimulus={question.stimulus} idPrefix={`q${question.position}`} />
      </div>

      {/* Two or three across on a phone, not four or five.
          A first pass laid every option out in one row at 375px, which made each
          figure about 55px wide. At that size a 45-degree rotation and a
          different fill are simply not distinguishable, so the test was asking a
          question the screen could not show. Wider screens get the single row
          back. */}
      <div
        role="group"
        aria-label="Answer options"
        className={`grid gap-3 ${
          question.options.length === 5
            ? 'grid-cols-3 sm:grid-cols-5'
            : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {question.options.map((option, i) => {
          const selected = chosen === i
          return (
            <button
              key={i}
              type="button"
              aria-pressed={selected}
              aria-label={optionLabel(i, option.description)}
              onClick={() => setChosen(i)}
              disabled={busy}
              className={`relative min-h-[48px] rounded-xl border-2 p-1 transition-colors disabled:opacity-60 ${
                selected
                  ? 'border-ember bg-brand-50'
                  : 'border-transparent bg-transparent hover:border-ember/40'
              }`}
            >
              {/* Selection is marked by a border, a tint AND a word, never by
                  colour alone. */}
              <FigureCell
                figure={option.figure}
                idPrefix={`q${question.position}o${i}`}
                label={null}
                className={selected ? 'border-ember' : ''}
              />
              <span
                aria-hidden="true"
                className={`mt-1 block text-center font-mono text-[11px] ${
                  selected ? 'font-bold text-ember' : 'text-ink-2'
                }`}
              >
                {selected ? 'Chosen' : i + 1}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => answer(null)}
          disabled={busy}
          className="inline-flex min-h-[48px] items-center rounded-xl px-4 text-sm font-semibold text-ink-2 underline transition-colors hover:bg-black/5 disabled:opacity-40"
        >
          Skip this one
        </button>
        <button
          type="button"
          onClick={() => answer(chosen)}
          disabled={busy || chosen === null}
          className="inline-flex min-h-[48px] items-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Saving…' : isLast ? 'Finish and see the result' : 'Next puzzle'}
        </button>
      </div>

      <p className="mt-3 text-sm text-ink-2">
        Pick one, then press next. You cannot come back to a puzzle, and a skip counts the same
        as a wrong answer.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  )
}
