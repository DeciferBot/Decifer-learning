'use client'

import { useEffect, useState } from 'react'

interface Question {
  id: string
  question_text: string
  question_type: string
  correct_answer: string
  distractors: string[]
  hint_1: string | null
  tier: string
}

interface Challenge {
  id: string
  date: string
  isFlare: boolean
  questions: Question[]
}

interface SubmitResult {
  results: Array<{ questionId: string; correct: boolean }>
  correctCount: number
  totalQuestions: number
  pointsEarned: number
  isFlare: boolean
}

type Phase = 'loading' | 'no-challenge' | 'quiz' | 'done' | 'error'

export default function DailyChallengePageInner() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)

  useEffect(() => {
    fetch('/api/daily-challenge/today')
      .then((r) => r.json())
      .then((data) => {
        if (!data.challenge || data.challenge.questions.length === 0) {
          setPhase('no-challenge')
        } else {
          setChallenge(data.challenge)
          setPhase('quiz')
        }
      })
      .catch(() => setPhase('error'))
  }, [])

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted">Loading today&apos;s challenge…</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted">Something went wrong loading today&apos;s challenge.</p>
        <button
          onClick={() => { setPhase('loading'); window.location.reload() }}
          className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (phase === 'no-challenge') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center px-4">
        <span className="text-4xl">⏳</span>
        <h1 className="font-heading text-xl font-bold text-ink">No challenge today</h1>
        <p className="text-sm text-muted max-w-xs">
          Today&apos;s challenge hasn&apos;t been set up yet. Check back tomorrow!
        </p>
      </div>
    )
  }

  if (phase === 'done' && result) {
    const pct = Math.round((result.correctCount / result.totalQuestions) * 100)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-4 max-w-md mx-auto">
        <span className="text-5xl">{pct >= 70 ? '⭐' : '🎯'}</span>
        <h1 className="font-heading text-2xl font-bold text-ink">
          {pct >= 100 ? 'Perfect!' : pct >= 70 ? 'Great work!' : 'Nice try!'}
        </h1>
        <p className="text-base text-muted">
          {result.correctCount} out of {result.totalQuestions} correct
        </p>
        {result.isFlare && (
          <span className="rounded-full bg-points-gold/20 px-4 py-1 text-xs font-bold text-points-gold">
            ⚡ Flare Challenge!
          </span>
        )}
        <div className="rounded-2xl border border-black/5 bg-surface px-8 py-4 shadow-sm">
          <p className="font-heading text-3xl font-bold text-ink">+{result.pointsEarned}</p>
          <p className="text-xs text-muted mt-0.5">points earned</p>
        </div>
        <a
          href="/dashboard/child"
          className="mt-2 rounded-xl bg-brand px-6 py-3 font-heading font-bold text-white shadow-sm hover:opacity-90"
        >
          Back to home
        </a>
      </div>
    )
  }

  if (!challenge) return null

  const q = challenge.questions[current]
  const options = [q.correct_answer, ...(q.distractors as string[])].sort()
  const isLast = current === challenge.questions.length - 1

  function choose(opt: string) {
    if (selected !== null) return
    setSelected(opt)
    setAnswers((prev) => ({ ...prev, [q.id]: opt }))
  }

  async function next() {
    if (!challenge) return
    setSelected(null)
    setShowHint(false)
    if (!isLast) {
      setCurrent((c) => c + 1)
      return
    }
    // Submit
    const allAnswers = Object.entries({ ...answers, [q.id]: selected ?? '' }).map(
      ([questionId, answer]) => ({ questionId, answer }),
    )
    const res = await fetch('/api/daily-challenge/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: challenge!.id, answers: allAnswers }),
    })
    const data = await res.json() as SubmitResult
    setResult(data)
    setPhase('done')
  }

  return (
    <div className="max-w-lg mx-auto px-4 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">
            {challenge.isFlare ? '⚡ Flare Challenge' : '🌟 Daily Challenge'}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Question {current + 1} of {challenge.questions.length}
          </p>
        </div>
        <div className="flex gap-1">
          {challenge.questions.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i < current ? 'bg-correct' :
                i === current ? 'bg-brand' :
                'bg-black/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm">
        <p className="text-base font-semibold text-ink leading-snug">{q.question_text}</p>

        {q.hint_1 && (
          <div className="mt-3">
            {showHint ? (
              <p className="rounded-xl bg-points-gold/10 px-3 py-2 text-sm text-points-gold">
                💡 {q.hint_1}
              </p>
            ) : (
              <button
                onClick={() => setShowHint(true)}
                className="text-xs text-muted underline underline-offset-2 hover:text-ink"
              >
                Show hint
              </button>
            )}
          </div>
        )}
      </div>

      {/* Answer options */}
      <div className="space-y-2">
        {options.map((opt) => {
          const isCorrect  = opt === q.correct_answer
          const isSelected = opt === selected
          let cls = 'w-full rounded-2xl border p-4 text-left text-sm font-medium transition-colors'
          if (selected === null) {
            cls += ' border-black/10 bg-surface hover:border-brand/40 hover:bg-brand/5 text-ink'
          } else if (isSelected && isCorrect) {
            cls += ' border-correct bg-correct/10 text-correct'
          } else if (isSelected && !isCorrect) {
            cls += ' border-incorrect bg-incorrect/10 text-incorrect'
          } else if (!isSelected && isCorrect) {
            cls += ' border-correct bg-correct/5 text-correct'
          } else {
            cls += ' border-black/5 bg-black/[0.02] text-muted'
          }
          return (
            <button key={opt} className={cls} onClick={() => choose(opt)}>
              {opt}
            </button>
          )
        })}
      </div>

      {/* Next / Submit */}
      {selected !== null && (
        <button
          onClick={next}
          className="w-full rounded-2xl bg-brand py-4 font-heading font-bold text-white shadow-sm hover:opacity-90"
        >
          {isLast ? 'Finish & get points' : 'Next question →'}
        </button>
      )}
    </div>
  )
}
