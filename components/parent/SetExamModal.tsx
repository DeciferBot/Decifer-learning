'use client'

import { useState } from 'react'
import { ClipboardList, CircleX } from '@/components/ui/icons'

type Subject = { id: string; name: string; colour_token: string }
type YearGroup = { id: string; label: string }

interface Props {
  childProfileId: string
  childName: string
  subjects: Subject[]
  yearGroupId: string | null
  yearGroupLabel: string | null
  onClose: () => void
  onSuccess: () => void
}

export function SetExamModal({
  childProfileId,
  childName,
  subjects,
  yearGroupId,
  yearGroupLabel,
  onClose,
  onSuccess,
}: Props) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [topicScope, setTopicScope] = useState<'all' | 'weak_areas'>('all')
  const [questionCount, setQuestionCount] = useState(20)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30)
  const [hintsAllowed, setHintsAllowed] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedSubject = subjects.find((s) => s.id === subjectId)
  const defaultTitle = selectedSubject
    ? `${selectedSubject.name} revision${yearGroupLabel ? ` — ${yearGroupLabel}` : ''}`
    : 'Revision exam'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subjectId || !yearGroupId) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/exam/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childProfileId,
        subjectId,
        yearGroupId,
        title: title.trim() || defaultTitle,
        topicScope,
        questionCount,
        timeLimitMinutes,
        hintsAllowed,
      }),
    })

    if (res.ok) {
      onSuccess()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Could not assign exam. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4 pb-4 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-maths" aria-hidden />
            <h2 className="font-heading text-base font-bold text-ink">Set exam for {childName}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-black/[0.05] min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <CircleX className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">
              Exam title <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
              className="w-full rounded-xl border border-black/10 bg-background px-3 py-2.5 text-sm text-ink placeholder-muted focus:border-maths focus:outline-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">Subject</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSubjectId(s.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors min-h-[44px] ${
                    subjectId === s.id
                      ? 'text-white'
                      : 'bg-black/[0.05] text-ink hover:bg-black/10'
                  }`}
                  style={subjectId === s.id ? { backgroundColor: s.colour_token } : {}}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">Question pool</label>
            <div className="flex gap-2">
              {(['all', 'weak_areas'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setTopicScope(scope)}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-[48px] ${
                    topicScope === scope
                      ? 'bg-maths/10 text-maths font-semibold'
                      : 'bg-black/[0.04] text-ink hover:bg-black/[0.07]'
                  }`}
                >
                  {scope === 'all' ? 'All topics' : 'Weak areas only'}
                </button>
              ))}
            </div>
            {topicScope === 'weak_areas' && (
              <p className="mt-1.5 text-xs text-muted">
                Only topics where {childName} has shown lower accuracy will be included. Falls back to all topics if no weak areas are found yet.
              </p>
            )}
          </div>

          {/* Question count */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">Number of questions</label>
            <div className="flex gap-2">
              {[10, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuestionCount(n)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors min-h-[48px] ${
                    questionCount === n
                      ? 'bg-maths/10 text-maths'
                      : 'bg-black/[0.04] text-ink hover:bg-black/[0.07]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Time limit */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">Time limit</label>
            <div className="flex gap-2">
              {[15, 20, 30, 45].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeLimitMinutes(t)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors min-h-[48px] ${
                    timeLimitMinutes === t
                      ? 'bg-maths/10 text-maths'
                      : 'bg-black/[0.04] text-ink hover:bg-black/[0.07]'
                  }`}
                >
                  {t}m
                </button>
              ))}
            </div>
          </div>

          {/* Hints */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Allow hints</p>
              <p className="text-xs text-muted">Off by default — matches real exam conditions</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hintsAllowed}
              onClick={() => setHintsAllowed(!hintsAllowed)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                hintsAllowed ? 'bg-maths' : 'bg-black/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  hintsAllowed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {!yearGroupId && (
            <p className="rounded-xl bg-lightning/20 px-3 py-2 text-xs text-ink">
              {childName} does not have a year group set — questions will be drawn from all years.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-incorrect/10 px-3 py-2 text-xs text-incorrect">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !subjectId}
            className="w-full rounded-2xl bg-maths py-3.5 font-heading text-sm font-bold text-white disabled:opacity-50 min-h-[52px]"
          >
            {saving ? 'Assigning…' : 'Assign exam'}
          </button>
        </form>
      </div>
    </div>
  )
}
