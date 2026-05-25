'use client'

// Admin action buttons for a single open report.
// Calls PATCH /api/admin/questions/[questionId]/report with one of three actions.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId:   string
  questionId: string
}

type Action = 'reviewed' | 'dismissed' | 'flag_question'

const ACTIONS: { action: Action; label: string; className: string }[] = [
  { action: 'reviewed',      label: 'Reviewed',      className: 'bg-surface border border-black/10 text-ink hover:bg-black/5' },
  { action: 'dismissed',     label: 'Dismiss',        className: 'bg-surface border border-black/10 text-muted hover:bg-black/5' },
  { action: 'flag_question', label: '🚩 Flag',        className: 'bg-incorrect/10 border border-incorrect/20 text-incorrect hover:bg-incorrect/20' },
]

export function MonitoringActions({ reportId, questionId }: Props) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleAction(action: Action) {
    if (busy || done) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/report`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reportId, action }),
      })
      if (!res.ok) throw new Error('Request failed')
      setDone(true)
      router.refresh()
    } catch {
      setBusy(false)
    }
  }

  if (done) {
    return <span className="text-xs text-correct font-medium">Done ✓</span>
  }

  return (
    <div className="flex flex-none gap-1.5 flex-wrap justify-end">
      {ACTIONS.map(({ action, label, className }) => (
        <button
          key={action}
          disabled={busy}
          onClick={() => handleAction(action)}
          className={`rounded-xl px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${className}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
