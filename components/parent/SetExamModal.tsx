'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, CircleX } from '@/components/ui/icons'

type TopicOption = { id: string; title: string; questionCount: number; learnt: boolean }
type SubjectOption = {
  id: string
  name: string
  colour_token: string
  topics: TopicOption[]
  learntCount: number
}
type ExamOptions = {
  yearGroupId: string | null
  yearGroupLabel: string | null
  subjects: SubjectOption[]
}

interface Props {
  childProfileId: string
  childName: string
  onClose: () => void
  onSuccess: () => void
}

type Scope = 'learnt' | 'weak_areas' | 'pick'

export function SetExamModal({ childProfileId, childName, onClose, onSuccess }: Props) {
  const [options, setOptions] = useState<ExamOptions | null>(null)
  const [loadError, setLoadError] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [scope, setScope] = useState<Scope>('learnt')
  const [pickedTopicIds, setPickedTopicIds] = useState<Set<string>>(new Set())
  const [questionCount, setQuestionCount] = useState(20)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30)
  const [hintsAllowed, setHintsAllowed] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/exam/options?childId=${childProfileId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Could not load exam options')
        return r.json()
      })
      .then((d: ExamOptions) => {
        if (cancelled) return
        setOptions(d)
        const first = d.subjects.find((s) => s.learntCount > 0) ?? d.subjects[0]
        if (first) setSubjectId(first.id)
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message)
      })
    return () => { cancelled = true }
  }, [childProfileId])

  const selectedSubject = options?.subjects.find((s) => s.id === subjectId) ?? null
  const learntTopics = useMemo(
    () => selectedSubject?.topics.filter((t) => t.learnt) ?? [],
    [selectedSubject],
  )

  const defaultTitle = selectedSubject
    ? `${selectedSubject.name} revision${options?.yearGroupLabel ? `: ${options.yearGroupLabel}` : ''}`
    : 'Revision exam'

  // Reset picked topics when the subject changes
  useEffect(() => {
    setPickedTopicIds(new Set())
  }, [subjectId])

  function togglePicked(topicId: string) {
    setPickedTopicIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  const noLearntContent = selectedSubject !== null && learntTopics.length === 0
  const canSubmit =
    !!selectedSubject &&
    !!options?.yearGroupId &&
    !noLearntContent &&
    (scope !== 'pick' || pickedTopicIds.size > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !selectedSubject || !options?.yearGroupId) return
    setSaving(true)
    setError('')

    // 'learnt' (whole subject, learnt topics only) and 'pick' both map to a
    // snapshot of explicit topic IDs; 'weak_areas' is resolved server-side.
    const topicScope = scope === 'weak_areas' ? 'weak_areas' : 'selected'
    const topicIds =
      scope === 'pick'
        ? [...pickedTopicIds]
        : scope === 'learnt'
          ? learntTopics.map((t) => t.id)
          : undefined

    const res = await fetch('/api/exam/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childProfileId,
        subjectId: selectedSubject.id,
        yearGroupId: options.yearGroupId,
        title: title.trim() || defaultTitle,
        topicScope,
        topicIds,
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
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-xl">
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

        {/* Loading / error states */}
        {!options && !loadError && (
          <p className="px-5 py-8 text-center text-sm text-muted">Loading subjects…</p>
        )}
        {loadError && (
          <p className="mx-5 my-5 rounded-xl bg-incorrect/10 px-3 py-2 text-xs text-incorrect">{loadError}</p>
        )}
        {options && !options.yearGroupId && (
          <p className="mx-5 my-5 rounded-xl bg-lightning/20 px-3 py-2 text-xs text-ink">
            {childName} does not have a year group set yet. Set a year group first so exams
            match their curriculum.
          </p>
        )}
        {options && options.yearGroupId && options.subjects.length === 0 && (
          <p className="mx-5 my-5 rounded-xl bg-lightning/20 px-3 py-2 text-xs text-ink">
            No subjects with quiz content are available for {options.yearGroupLabel} yet.
          </p>
        )}

        {options && options.yearGroupId && options.subjects.length > 0 && (
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

            {/* Subject — only subjects with published questions for this year group */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">Subject</label>
              <div className="flex flex-wrap gap-2">
                {options.subjects.map((s) => (
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
                    <span className={`ml-1.5 text-xs font-normal ${subjectId === s.id ? 'text-white/80' : 'text-muted'}`}>
                      {s.learntCount} learnt
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {noLearntContent ? (
              <p className="rounded-xl bg-lightning/20 px-3 py-2 text-xs text-ink">
                {childName} hasn&apos;t learnt any {selectedSubject?.name} topics yet. Exams can
                only cover topics they have already learnt. Try another subject, or come back
                once they&apos;ve completed a lesson or quiz.
              </p>
            ) : (
              <>
                {/* Scope */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink">Question pool</label>
                  <div className="flex gap-2">
                    {([
                      { key: 'learnt', label: 'All learnt topics' },
                      { key: 'weak_areas', label: 'Weak areas' },
                      { key: 'pick', label: 'Pick topics' },
                    ] as { key: Scope; label: string }[]).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setScope(key)}
                        className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors min-h-[48px] ${
                          scope === key
                            ? 'bg-maths/10 text-maths font-semibold'
                            : 'bg-black/[0.04] text-ink hover:bg-black/[0.07]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {scope === 'learnt' && (
                    <p className="mt-1.5 text-xs text-muted">
                      Covers all {learntTopics.length} {selectedSubject?.name} topic{learntTopics.length === 1 ? '' : 's'} {childName} has learnt so far.
                    </p>
                  )}
                  {scope === 'weak_areas' && (
                    <p className="mt-1.5 text-xs text-muted">
                      Only topics where {childName} has shown lower accuracy. Falls back to
                      everything they&apos;ve learnt if no weak areas are found yet.
                    </p>
                  )}
                </div>

                {/* Topic picker */}
                {scope === 'pick' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink">
                      Topics <span className="font-normal text-muted">({pickedTopicIds.size} selected)</span>
                    </label>
                    <ul className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-black/5 bg-background p-2">
                      {learntTopics.map((t) => (
                        <li key={t.id}>
                          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-black/[0.04]">
                            <input
                              type="checkbox"
                              checked={pickedTopicIds.has(t.id)}
                              onChange={() => togglePicked(t.id)}
                              className="h-4 w-4 flex-none accent-[#6C9EFF]"
                            />
                            <span className="min-w-0 flex-1 truncate">{t.title}</span>
                            <span className="flex-none text-xs text-muted">{t.questionCount} Qs</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-xs text-muted">
                      Only topics {childName} has already learnt are shown.
                    </p>
                  </div>
                )}

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
                    <p className="text-xs text-muted">Off by default, matches real exam conditions</p>
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
                      className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform ${
                        hintsAllowed ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}

            {error && (
              <p className="rounded-xl bg-incorrect/10 px-3 py-2 text-xs text-incorrect">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="w-full rounded-2xl bg-maths py-3.5 font-heading text-sm font-bold text-white disabled:opacity-50 min-h-[52px]"
            >
              {saving ? 'Assigning…' : 'Assign exam'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
