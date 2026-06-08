'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from '@/components/ui/icons'

type RunResult = {
  total: number
  flagged_high_error: number
  flagged_high_hint: number
  flagged_missing_visual: number
}

export function RunAnomalyButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState(false)

  async function run() {
    if (running) return
    setRunning(true)
    setResult(null)
    setError(false)
    try {
      const res = await fetch('/api/admin/run-anomaly-detect', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const data: RunResult = await res.json()
      setResult(data)
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-black/5 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} aria-hidden />
        {running ? 'Running…' : 'Run detection now'}
      </button>
      {result !== null && (
        <span className="text-xs text-muted">
          Done —{' '}
          {result.total === 0
            ? 'no new issues found ✓'
            : <>flagged <strong className="text-ink">{result.total}</strong> question{result.total !== 1 ? 's' : ''} ({result.flagged_high_error} error rate · {result.flagged_high_hint} hint rate · {result.flagged_missing_visual} missing visual)</>
          }
        </span>
      )}
      {error && <span className="text-xs text-incorrect">Run failed — check server logs</span>}
    </div>
  )
}
