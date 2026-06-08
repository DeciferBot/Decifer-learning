'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Check } from '@/components/ui/icons'

type ExamCard = {
  id: string
  title: string
  questionCount: number
  timeLimitMinutes: number
  hintsAllowed: boolean
  subject: { name: string; colour_token: string }
  attempts: { id: string; score: number | null; status: string; completed_at: string | null }[]
}

export default function ExamLobbyPage() {
  const [exams, setExams] = useState<ExamCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/exam/child')
      .then((r) => r.json())
      .then((d) => {
        setExams(
          (d.assignments ?? []).map((a: {
            id: string
            title: string
            question_count: number
            time_limit_minutes: number
            hints_allowed: boolean
            subject: { name: string; colour_token: string }
            attempts: { id: string; score: number | null; status: string; completed_at: string | null }[]
          }) => ({
            id: a.id,
            title: a.title,
            questionCount: a.question_count,
            timeLimitMinutes: a.time_limit_minutes,
            hintsAllowed: a.hints_allowed,
            subject: a.subject,
            attempts: a.attempts,
          }))
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted">Loading exams…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3 pt-2">
        <ClipboardList className="h-6 w-6 text-maths" aria-hidden />
        <h1 className="font-heading text-2xl font-bold text-ink">Exam Revision</h1>
      </div>
      <p className="text-sm text-muted">
        Timed practice exams set by your parent. Questions come from across the whole subject.
      </p>

      {exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-surface px-6 py-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted" aria-hidden />
          <p className="font-heading text-base font-semibold text-ink">No exams set yet</p>
          <p className="mt-1 text-sm text-muted">
            Your parent can set an exam from their dashboard.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {exams.map((exam) => {
            const attempt = exam.attempts[0]
            const done = attempt && attempt.status !== 'in_progress'
            const pct = done && attempt.score != null ? Math.round(attempt.score * 100) : null

            return (
              <li
                key={exam.id}
                className="rounded-2xl border border-black/5 bg-surface shadow-sm"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{ backgroundColor: exam.subject.colour_token }}
                          aria-hidden
                        />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {exam.subject.name}
                        </span>
                      </div>
                      <p className="font-heading text-base font-bold text-ink">{exam.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {exam.questionCount} questions · {exam.timeLimitMinutes} min
                        {exam.hintsAllowed ? ' · hints on' : ''}
                      </p>
                    </div>
                    {done && pct != null ? (
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                            pct >= 80
                              ? 'bg-correct/10 text-correct'
                              : pct >= 60
                              ? 'bg-lightning/20 text-ink'
                              : 'bg-incorrect/10 text-incorrect'
                          }`}
                        >
                          <Check className="h-3 w-3" aria-hidden />
                          {pct}%
                        </span>
                        <Link
                          href={`/exam/${exam.id}/result?attemptId=${attempt.id}`}
                          className="text-xs font-semibold text-maths underline underline-offset-2"
                        >
                          View results
                        </Link>
                      </div>
                    ) : (
                      <Link
                        href={`/exam/${exam.id}`}
                        className="flex-none rounded-xl bg-maths px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-maths/90 min-h-[44px] flex items-center"
                      >
                        Start
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
