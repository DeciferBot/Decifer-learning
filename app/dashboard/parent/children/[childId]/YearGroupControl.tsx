'use client'

// Lets a parent set which school year their child is in.
//
// Two guard rails, both because getting this wrong is worse than not changing
// it at all: nothing saves until the parent presses Save, and a year they have
// picked that is not the current one shows a plain warning about what changes.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MVP_YEAR_GROUPS, EXAM_BOARDS, yearGroupRequiresExamBoard } from '@/lib/auth/roles'
import type { YearGroupLabel, ExamBoard } from '@/lib/auth/roles'

interface Props {
  childId: string
  childName: string
  currentYearGroup: YearGroupLabel | null
  currentExamBoard: ExamBoard | null
}

export function YearGroupControl({
  childId,
  childName,
  currentYearGroup,
  currentExamBoard,
}: Props) {
  const router = useRouter()
  const [year, setYear] = useState<YearGroupLabel | ''>(currentYearGroup ?? '')
  const [board, setBoard] = useState<ExamBoard | ''>(currentExamBoard ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsBoard = year !== '' && yearGroupRequiresExamBoard(year)
  const changed = year !== '' && (year !== currentYearGroup || (needsBoard && board !== currentExamBoard))

  async function save() {
    if (year === '') return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/parent/year-group/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearGroup: year, examBoard: needsBoard ? board : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not save that. Please try again.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Could not save that. Please check your connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="year-group" className="block text-sm font-semibold text-ink">
          School year
        </label>
        <select
          id="year-group"
          value={year}
          onChange={(e) => {
            setYear(e.target.value as YearGroupLabel)
            setSaved(false)
            setError(null)
          }}
          className="min-h-[48px] w-full rounded-xl border border-black/10 bg-surface px-4 text-base font-semibold text-ink"
        >
          <option value="" disabled>
            Choose a year
          </option>
          {MVP_YEAR_GROUPS.map((y) => (
            <option key={y.label} value={y.label}>
              {y.display} ({y.keyStage})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          {childName} will see the lessons, quizzes and map for this year.
        </p>
      </div>

      {needsBoard && (
        <div className="space-y-2">
          <label htmlFor="exam-board" className="block text-sm font-semibold text-ink">
            Exam board
          </label>
          <select
            id="exam-board"
            value={board}
            onChange={(e) => {
              setBoard(e.target.value as ExamBoard)
              setSaved(false)
              setError(null)
            }}
            className="min-h-[48px] w-full rounded-xl border border-black/10 bg-surface px-4 text-base font-semibold text-ink"
          >
            <option value="" disabled>
              Choose a board
            </option>
            {EXAM_BOARDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">GCSE years need a board so the questions match.</p>
        </div>
      )}

      {changed && (
        <p className="rounded-xl bg-points-gold/10 px-4 py-3 text-xs text-ink">
          {childName} keeps every point, badge and card. Work finished in their old
          year stays saved under that year, so the progress bars for the new year
          start from zero.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-incorrect/10 px-4 py-3 text-sm font-semibold text-incorrect">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !changed || (needsBoard && board === '')}
          className="min-h-[48px] rounded-xl bg-brand-600 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save school year'}
        </button>
        {saved && !changed && (
          <span className="text-sm font-semibold text-correct">Saved</span>
        )}
      </div>
    </div>
  )
}
