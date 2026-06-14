'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { WorldAtlas } from '@/components/explore/WorldAtlas'
import { AskDecifer } from '@/components/explore/AskDecifer'
import type { AtlasExplorer } from '@/lib/explore/types'

/**
 * Client shell for the World Atlas: session tracking + the Ask Decifer dock,
 * wrapping the data-driven globe experience. Content comes from the DB via the
 * server component that renders this.
 */
export function WorldAtlasExperience({ explorer }: { explorer: AtlasExplorer }) {
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
        body: JSON.stringify({ aidType: 'world-atlas', durationSeconds: duration, askCount: askCountRef.current }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [])

  const handleExplore = useCallback((topicKey: string) => {
    fetch('/api/explore/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aidType: 'world-atlas', topicKey }),
    }).catch(() => {})
  }, [])

  const handleAskDecifer = useCallback((context: string) => {
    setAskContext(context)
  }, [])

  return (
    <div className="fixed inset-0 z-10">
      <Link
        href="/explore"
        className="absolute top-4 left-4 z-30 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/80 backdrop-blur hover:bg-white/20 transition-colors"
        style={{ minHeight: 40 }}
      >
        ← Back
      </Link>

      <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">{explorer.title}</p>
      </div>

      <WorldAtlas explorer={explorer} onAskDecifer={handleAskDecifer} onExplore={handleExplore} />

      <AskDecifer
        aid="world-atlas"
        initialContext={askContext}
        onAskCountChange={(count) => { askCountRef.current = count }}
      />
    </div>
  )
}
