'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check } from '@/components/ui/icons'

interface Mission {
  id: string
  type: string
  title: string
  emoji: string
  targetValue: number | null
  currentValue: number
  completed: boolean
  completedAt: string | null
  progress: number
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [generating, setGenerating] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/missions')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setMissions(data.missions ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const active    = missions.filter((m) => !m.completed)
  const completed = missions.filter((m) => m.completed)

  async function generateMissions() {
    setGenerating(true)
    await fetch('/api/missions', { method: 'POST' })
    await load()
    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted">Loading missions…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-3xl">😕</p>
        <p className="text-sm text-muted">Couldn't load your missions right now.</p>
        <button
          onClick={() => void load()}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 space-y-5 pb-8">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Missions</h1>
          <p className="text-sm text-muted mt-0.5">Complete goals to earn bonus rewards</p>
        </div>
        <Link href="/dashboard/child" className="text-sm text-muted hover:text-ink">
          ← Home
        </Link>
      </div>

      {/* Active missions */}
      {active.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center space-y-3">
          <p className="text-sm text-muted">No active missions yet.</p>
          <button
            onClick={generateMissions}
            disabled={generating}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {generating ? 'Generating…' : 'Get missions'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}

      {/* Completed missions */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted px-1">Completed</p>
          {completed.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-black/[0.02] p-4 opacity-60">
              <span className="text-xl">{m.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink line-through">{m.title}</p>
                {m.completedAt && (
                  <p className="text-xs text-muted">
                    Completed {new Date(m.completedAt).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
              <Check className="flex-none w-5 h-5 text-correct" aria-hidden />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MissionCard({ mission: m }: { mission: Mission }) {
  const pct = Math.round(m.progress * 100)

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-none">{m.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm leading-snug">{m.title}</p>
          {m.targetValue !== null && (
            <p className="text-xs text-muted mt-0.5">
              {m.currentValue.toLocaleString()} / {m.targetValue.toLocaleString()}
            </p>
          )}
        </div>
        <span className="flex-none rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold text-muted">
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-black/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
