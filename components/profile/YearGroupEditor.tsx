'use client'

// Inline school-year editor for the child profile page. Kids who picked the
// wrong year at signup (Y7 used to be pre-selected) can fix it themselves.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MVP_YEAR_GROUPS,
  EXAM_BOARDS,
  yearGroupRequiresExamBoard,
  type YearGroupLabel,
  type ExamBoard,
} from '@/lib/auth/roles'

export function YearGroupEditor({ current }: { current: YearGroupLabel }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [yearGroup, setYearGroup] = useState<YearGroupLabel>(current)
  const [examBoard, setExamBoard] = useState<ExamBoard | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentDef = MVP_YEAR_GROUPS.find((y) => y.label === current)
  const needsExamBoard = yearGroupRequiresExamBoard(yearGroup)

  async function save() {
    if (needsExamBoard && !examBoard) {
      setError('Choose your exam board for GCSE subjects.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/year-group', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearGroup, ...(needsExamBoard ? { examBoard } : {}) }),
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not save. Try again.')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {currentDef ? `${currentDef.display} · ${currentDef.keyStage}` : current}
        <button
          type="button"
          onClick={() => { setYearGroup(current); setExamBoard(''); setEditing(true) }}
          className="ml-2 font-semibold underline"
          style={{ color: 'var(--brand)' }}
        >
          Change
        </button>
      </p>
    )
  }

  return (
    <div className="mt-1 space-y-2">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        In the wrong year? Pick the school year you&apos;re in now — your world map and quizzes
        will switch to match.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={yearGroup}
          onChange={(e) => { setYearGroup(e.target.value as YearGroupLabel); setExamBoard('') }}
          disabled={busy}
          aria-label="School year"
          className="min-h-[44px] rounded-xl border border-black/10 bg-white px-3 text-sm text-ink focus:outline-none"
        >
          {MVP_YEAR_GROUPS.map((y) => (
            <option key={y.label} value={y.label}>{y.display} ({y.keyStage})</option>
          ))}
        </select>
        {needsExamBoard ? (
          <select
            value={examBoard}
            onChange={(e) => setExamBoard(e.target.value as ExamBoard | '')}
            disabled={busy}
            aria-label="Exam board"
            className="min-h-[44px] rounded-xl border border-black/10 bg-white px-3 text-sm text-ink focus:outline-none"
          >
            <option value="">Exam board…</option>
            {EXAM_BOARDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={busy || yearGroup === current}
          className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--brand)' }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null) }}
          disabled={busy}
          className="min-h-[44px] rounded-xl px-3 text-sm font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium" style={{ color: 'var(--incorrect, #FF6B6B)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
