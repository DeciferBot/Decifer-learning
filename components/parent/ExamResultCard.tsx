'use client'

import Link from 'next/link'
import { Check, CircleX } from '@/components/ui/icons'

type Attempt = {
  id: string
  score: number | null
  status: string
  completed_at: string | null
}

interface Props {
  assignmentId: string
  title: string
  questionCount: number
  timeLimitMinutes: number
  subject: { name: string; colour_token: string }
  attempt: Attempt | null
  childName: string
}

export function ExamResultCard({
  assignmentId,
  title,
  questionCount,
  timeLimitMinutes,
  subject,
  attempt,
  childName,
}: Props) {
  const done = attempt && attempt.status !== 'in_progress'
  const pct = done && attempt?.score != null ? Math.round(attempt.score * 100) : null

  return (
    <div className="rounded-xl border border-black/5 bg-background px-4 py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 flex-none rounded-full"
              style={{ backgroundColor: subject.colour_token }}
              aria-hidden
            />
            <span className="text-xs text-muted">{subject.name}</span>
          </div>
          <p className="text-sm font-semibold text-ink truncate">{title}</p>
          <p className="text-xs text-muted">
            {questionCount} questions · {timeLimitMinutes} min
          </p>
        </div>

        {done && pct != null ? (
          <div className="flex flex-col items-end gap-1">
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                pct >= 80
                  ? 'bg-correct/10 text-correct'
                  : pct >= 60
                  ? 'bg-lightning/20 text-ink'
                  : 'bg-incorrect/10 text-incorrect'
              }`}
            >
              {pct >= 60 ? (
                <Check className="h-3 w-3" aria-hidden />
              ) : (
                <CircleX className="h-3 w-3" aria-hidden />
              )}
              {pct}%
            </span>
            {attempt?.id && (
              <Link
                href={`/api/exam/result/${attempt.id}`}
                className="text-xs font-semibold text-maths underline underline-offset-2"
              >
                See breakdown →
              </Link>
            )}
          </div>
        ) : attempt?.status === 'in_progress' ? (
          <span className="rounded-full bg-lightning/20 px-2 py-0.5 text-xs font-bold text-ink">
            In progress
          </span>
        ) : (
          <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs text-muted">
            Not started
          </span>
        )}
      </div>
    </div>
  )
}
