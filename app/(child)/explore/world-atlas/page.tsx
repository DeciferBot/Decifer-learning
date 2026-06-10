'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { WorldAtlas } from '@/components/explore/WorldAtlas'
import { AskDecifer } from '@/components/explore/AskDecifer'

export default function WorldAtlasPage() {
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
      {/* Back */}
      <Link
        href="/explore"
        className="absolute top-4 left-4 z-30 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/80 backdrop-blur hover:bg-white/20 transition-colors"
        style={{ minHeight: 36 }}
      >
        ← Back
      </Link>

      {/* Title */}
      <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">World Atlas</p>
      </div>

      <WorldAtlas onAskDecifer={handleAskDecifer} onExplore={handleExplore} />

      <AskDecifer
        aid="world-atlas"
        initialContext={askContext}
        onAskCountChange={(count) => { askCountRef.current = count }}
      />
    </div>
  )
}
