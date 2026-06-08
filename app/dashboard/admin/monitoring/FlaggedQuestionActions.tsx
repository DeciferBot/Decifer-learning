'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RefreshCw, X } from '@/components/ui/icons'

interface Props {
  questionId: string
}

export function FlaggedQuestionActions({ questionId }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'reinstated' | 'deleted' | null>(null)

  async function act(action: 'reinstate' | 'delete') {
    if (busy || done) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Failed')
      setDone(action === 'reinstate' ? 'reinstated' : 'deleted')
      router.refresh()
    } catch {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-correct">
        <Check className="w-3.5 h-3.5" aria-hidden />
        {done === 'reinstated' ? 'Reinstated' : 'Deleted'}
      </span>
    )
  }

  return (
    <div className="flex flex-none gap-1.5">
      <button
        disabled={busy}
        onClick={() => act('reinstate')}
        title="Reinstate — mark as published again"
        className="inline-flex items-center gap-1 rounded-xl border border-correct/30 bg-correct/10 px-2.5 py-1 text-xs font-medium text-correct hover:bg-correct/20 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className="w-3 h-3" aria-hidden />
        Reinstate
      </button>
      <button
        disabled={busy}
        onClick={() => act('delete')}
        title="Delete permanently"
        className="inline-flex items-center gap-1 rounded-xl border border-incorrect/30 bg-incorrect/10 px-2.5 py-1 text-xs font-medium text-incorrect hover:bg-incorrect/20 disabled:opacity-50 transition-colors"
      >
        <X className="w-3 h-3" aria-hidden />
        Delete
      </button>
    </div>
  )
}
