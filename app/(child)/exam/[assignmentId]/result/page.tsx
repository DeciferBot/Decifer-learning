'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import MathText from '@/components/ui/MathText'
import { Check, CircleX, ClipboardList, Star } from '@/components/ui/icons'

type ReviewItem = {
  questionId: string
  questionText: string
  questionType: string
  correctAnswer: string
  explanation: string | null
  topicId: string
  topicTitle: string
  childAnswer: string
  wasCorrect: boolean
  timeSeconds: number
}

type Breakdown = {
  topicId: string
  topicTitle: string
  correct: number
  total: number
}

type ResultData = {
  attempt: {
    id: string
    status: string
    score: number | null
    timeTakenSeconds: number | null
    startedAt: string
    completedAt: string | null
  }
  assignment: {
    title: string
    questionCount: number
    timeLimitMinutes: number
    subject: { name: string; colour_token: string }
  }
  breakdown: Breakdown[]
  reviewItems: ReviewItem[]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default function ExamResultPage({
  params,
}: {
  params: { assignmentId: string }
}) {
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('attemptId')
  const [data, setData] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!attemptId) { setLoading(false); return }
    fetch(`/api/exam/result/${attemptId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [attemptId])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted">Loading results…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-sm text-muted">Results not found.</p>
        <a href="/exam" className="text-sm font-bold text-maths underline">Back to exams</a>
      </div>
    )
  }

  const pct = data.attempt.score != null ? Math.round(data.attempt.score * 100) : 0
  const correct = data.reviewItems.filter((r) => r.wasCorrect).length
  const total = data.reviewItems.length
  const timedOut = data.attempt.status === 'timed_out'

  const scoreColour =
    pct >= 80 ? 'text-correct' : pct >= 60 ? 'text-points-gold-700' : 'text-incorrect'
  const scoreBg =
    pct >= 80 ? 'bg-correct/10' : pct >= 60 ? 'bg-lightning/20' : 'bg-incorrect/10'

  return (
    <div className="space-y-5 pb-24">
      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl px-6 py-8 text-center ${scoreBg}`}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: data.assignment.subject.colour_token }}
            aria-hidden
          />
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {data.assignment.subject.name} · {data.assignment.title}
          </p>
        </div>
        <p className={`font-heading text-6xl font-bold ${scoreColour}`}>{pct}%</p>
        <p className="mt-1 text-sm text-muted">
          {correct} / {total} correct
        </p>
        {timedOut && (
          <p className="mt-2 rounded-full bg-incorrect/20 px-4 py-1 text-xs font-bold text-incorrect inline-block">
            Time ran out — some questions marked unanswered
          </p>
        )}
        {data.attempt.timeTakenSeconds != null && (
          <p className="mt-2 text-xs text-muted">
            Time: {formatTime(data.attempt.timeTakenSeconds)} of {data.assignment.timeLimitMinutes} min allowed
          </p>
        )}
      </motion.div>

      {/* Points */}
      {correct > 0 && !timedOut && (
        <div className="flex items-center gap-2 rounded-xl bg-points-gold/10 px-4 py-3">
          <Star className="h-4 w-4 text-points-gold" aria-hidden />
          <p className="text-sm font-semibold text-ink">
            +{Math.round(correct * 1.5)} points earned
          </p>
        </div>
      )}

      {/* Per-topic breakdown */}
      <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm space-y-3">
        <h2 className="font-heading text-base font-bold text-ink">Topic breakdown</h2>
        {data.breakdown.length === 0 ? (
          <p className="text-sm text-muted">No breakdown available.</p>
        ) : (
          <ul className="space-y-2">
            {data.breakdown.map((b) => {
              const bPct = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0
              return (
                <li key={b.topicId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink truncate">{b.topicTitle}</span>
                    <span className={`flex-none font-bold ${bPct >= 70 ? 'text-correct' : 'text-incorrect'}`}>
                      {b.correct}/{b.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className={`h-full rounded-full transition-all ${bPct >= 70 ? 'bg-correct' : 'bg-incorrect/60'}`}
                      style={{ width: `${bPct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Full question review */}
      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-ink px-1">
          Your marked paper
        </h2>
        {data.reviewItems.map((item, i) => (
          <div
            key={item.questionId}
            className={`rounded-2xl border px-5 py-4 shadow-sm ${
              item.wasCorrect ? 'border-correct/20 bg-correct/5' : 'border-incorrect/20 bg-incorrect/5'
            }`}
          >
            <div className="flex items-start gap-3">
              {item.wasCorrect ? (
                <Check className="mt-0.5 h-5 w-5 flex-none text-correct" aria-hidden />
              ) : (
                <CircleX className="mt-0.5 h-5 w-5 flex-none text-incorrect" aria-hidden />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-semibold text-muted">{i + 1}. {item.topicTitle}</p>
                <div className="text-sm font-semibold text-ink">
                  <MathText text={item.questionText} />
                </div>
                {!item.wasCorrect && (
                  <div className="rounded-lg bg-black/[0.04] px-3 py-2 space-y-1">
                    {item.childAnswer ? (
                      <p className="text-xs text-incorrect">
                        <span className="font-semibold">Your answer: </span>
                        <MathText text={item.childAnswer} />
                      </p>
                    ) : (
                      <p className="text-xs text-muted italic">Not answered</p>
                    )}
                    <p className="text-xs text-correct">
                      <span className="font-semibold">Correct: </span>
                      <MathText text={item.correctAnswer} />
                    </p>
                  </div>
                )}
                {item.explanation && (
                  <p className="text-xs text-muted">{item.explanation}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <a
        href="/exam"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-maths/10 py-4 font-heading text-sm font-bold text-maths min-h-[56px]"
      >
        <ClipboardList className="h-4 w-4" aria-hidden />
        Back to exams
      </a>
    </div>
  )
}
