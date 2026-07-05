'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { PeriodicTable } from '@/components/explore/PeriodicTable'
import { AskDecifer } from '@/components/explore/AskDecifer'
import type { PeriodicExplorer } from '@/lib/explore/types'

export function PeriodicTableExperience({ explorer }: { explorer: PeriodicExplorer }) {
  const [askContext, setAskContext] = useState<string | undefined>()
  const askCountRef = useRef(0)
  const openedAtRef = useRef<number>(Date.now())

  useEffect(() => {
    const startedAt = openedAtRef.current
    return () => {
      const duration = Math.round((Date.now() - startedAt) / 1000)
      fetch('/api/explore/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aidType: 'periodic-table', durationSeconds: duration, askCount: askCountRef.current }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [])

  const handleExplore = useCallback((topicKey: string) => {
    fetch('/api/explore/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aidType: 'periodic-table', topicKey }),
    }).catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-10">
      <Link
        href="/explore"
        className="absolute top-4 left-4 z-30 flex items-center gap-1.5 rounded-full bg-surface/10 px-3 py-1.5 text-sm font-semibold text-white/80 backdrop-blur hover:bg-surface/20 transition-colors"
        style={{ minHeight: 40 }}
      >
        ← Back
      </Link>
      <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">{explorer.title}</p>
      </div>

      <PeriodicTable explorer={explorer} onAskDecifer={setAskContext} onExplore={handleExplore} />

      <AskDecifer
        aid="periodic-table"
        initialContext={askContext}
        onAskCountChange={(count) => { askCountRef.current = count }}
      />
    </div>
  )
}
