'use client'

import { useState } from 'react'
import { Flag, Check } from '@/components/ui/icons'

interface Props {
  questionId: string
}

type State = 'idle' | 'open' | 'submitting' | 'done' | 'already'

export function ReportProblemButton({ questionId }: Props) {
  const [state, setState] = useState<State>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = reason.trim()
    if (!trimmed) { setError('Please describe the problem.'); return }
    setState('submitting')
    setError(null)
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      })
      const data = await res.json() as { ok?: boolean; alreadyReported?: boolean }
      if (data.alreadyReported) { setState('already'); return }
      if (data.ok) { setState('done'); return }
      throw new Error('unexpected')
    } catch {
      setState('open')
      setError('Something went wrong — please try again.')
    }
  }

  if (state === 'done') {
    return (
      <p className="mt-3 text-center text-xs text-correct flex items-center justify-center gap-1">
        <Check className="w-3.5 h-3.5" aria-hidden /> Report received — our team will review it.
      </p>
    )
  }

  if (state === 'already') {
    return (
      <p className="mt-3 text-center text-xs text-muted">
        You&apos;ve already reported this question.
      </p>
    )
  }

  if (state === 'open' || state === 'submitting') {
    return (
      <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4 space-y-3">
        <p className="text-xs font-semibold text-ink">What&apos;s wrong with this question?</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="e.g. The answer seems wrong, or the question is confusing…"
          className="w-full resize-none rounded-xl border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
          disabled={state === 'submitting'}
        />
        {error && <p className="text-xs text-incorrect">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={state === 'submitting'}
            className="flex h-9 items-center justify-center rounded-xl bg-brand px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === 'submitting' ? 'Sending…' : 'Send report'}
          </button>
          <button
            onClick={() => { setState('idle'); setReason(''); setError(null) }}
            disabled={state === 'submitting'}
            className="flex h-9 items-center justify-center rounded-xl border border-black/10 px-4 text-xs font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <button
      onClick={() => setState('open')}
      className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
    >
      <Flag className="w-3.5 h-3.5" aria-hidden /> Report a problem
    </button>
  )
}
