'use client'

// Admin button that triggers Phase 12 flagged-question regeneration.
// Calls POST /api/pipeline/regenerate-flagged and shows a result summary.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from '@/components/ui/icons'

type State = 'idle' | 'running' | 'done' | 'error'

export function RegenerateButton() {
  const router = useRouter()
  const [state,   setState]   = useState<State>('idle')
  const [summary, setSummary] = useState<string | null>(null)

  async function trigger() {
    if (state === 'running') return
    setState('running')
    setSummary(null)
    try {
      const res  = await fetch('/api/pipeline/regenerate-flagged', { method: 'POST' })
      const data = await res.json() as { triggered?: number; results?: Array<{ status: string }> }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed')

      const triggered  = data.triggered ?? 0
      const published  = (data.results ?? []).filter((r) => r.status === 'published').length
      const failed     = (data.results ?? []).filter((r) => r.status === 'failed').length
      setSummary(
        triggered === 0
          ? 'No flagged questions to regenerate.'
          : `Triggered ${triggered}: ${published} published, ${failed} failed.`,
      )
      setState('done')
      router.refresh()  // background — summary already displayed
    } catch (err) {
      setSummary(err instanceof Error ? err.message : 'Unknown error')
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={trigger}
        disabled={state === 'running'}
        className="flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === 'running' ? (
          <>
            <span className="animate-spin" aria-hidden>↻</span>
            Regenerating…
          </>
        ) : (
          <><RefreshCw className="w-3.5 h-3.5" aria-hidden /> Regenerate flagged</>
        )}
      </button>
      {summary && (
        <p className={`text-xs ${state === 'error' ? 'text-incorrect' : 'text-correct'}`}>
          {summary}
        </p>
      )}
    </div>
  )
}
