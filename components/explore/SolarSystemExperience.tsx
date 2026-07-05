'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { SolarSystem } from '@/components/explore/SolarSystem'
import { AskDecifer } from '@/components/explore/AskDecifer'
import type { ExplorerData } from '@/lib/explore/types'

/**
 * Client shell for the Solar System explorer: owns session tracking + the Ask
 * Decifer dock, and renders the data-driven 3D experience. Content comes from
 * the DB via the server component that renders this.
 */
export function SolarSystemExperience({ explorer }: { explorer: ExplorerData }) {
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
        body: JSON.stringify({ aidType: 'solar-system', durationSeconds: duration, askCount: askCountRef.current }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [])

  const handleExplore = useCallback((topicKey: string) => {
    fetch('/api/explore/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aidType: 'solar-system', topicKey }),
    }).catch(() => {})
  }, [])

  const handleAskDecifer = useCallback((context: string) => {
    setAskContext(context)
  }, [])

  return (
    <div className="fixed inset-0 z-10" style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
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

      <SolarSystem explorer={explorer} onAskDecifer={handleAskDecifer} onExplore={handleExplore} />

      <AskDecifer
        aid="solar-system"
        initialContext={askContext}
        onAskCountChange={(count) => { askCountRef.current = count }}
      />
    </div>
  )
}
