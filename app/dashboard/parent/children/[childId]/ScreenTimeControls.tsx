'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PRESET_MINUTES = [30, 45, 60, 90, 120]

interface Props {
  childId:     string
  initialLimit: number    // minutes
  leaderboardVisible: boolean
}

export function ScreenTimeControls({ childId, initialLimit, leaderboardVisible }: Props) {
  const router = useRouter()
  const [limit,   setLimit]   = useState(initialLimit)
  const [lb,      setLb]      = useState(leaderboardVisible)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  function save() {
    setSaving(true)
    setSaved(false)
    fetch(`/api/parent/screen-time/${childId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyTimeLimitMinutes: limit, leaderboardVisible: lb }),
    })
      .then(() => router.refresh())
      .catch(() => {})
      .finally(() => { setSaving(false); setSaved(true) })
  }

  return (
    <div className="space-y-4">
      {/* Daily time limit */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Daily quiz time limit</p>
          <span className="rounded-full bg-brand/10 px-3 py-0.5 text-xs font-bold text-brand">
            {limit} min
          </span>
        </div>
        <input
          type="range"
          min={15}
          max={180}
          step={15}
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setSaved(false) }}
          className="w-full accent-brand"
        />
        <div className="flex gap-2 flex-wrap">
          {PRESET_MINUTES.map((p) => (
            <button
              key={p}
              onClick={() => { setLimit(p); setSaved(false) }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                limit === p
                  ? 'bg-brand text-white'
                  : 'bg-black/5 text-muted hover:bg-black/10'
              }`}
            >
              {p} min
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Quiz attempts after this limit will be blocked for the day. Learn pages are always accessible.
        </p>
      </div>

      {/* Leaderboard */}
      <div className="flex items-center justify-between rounded-xl border border-black/5 bg-black/[0.02] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Show on family leaderboard</p>
          <p className="text-xs text-muted mt-0.5">Visible to siblings on the leaderboard</p>
        </div>
        <button
          onClick={() => { setLb((v) => !v); setSaved(false) }}
          className={`relative h-6 w-11 rounded-full transition-colors ${lb ? 'bg-correct' : 'bg-black/20'}`}
          role="switch"
          aria-checked={lb}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${lb ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
      </button>
    </div>
  )
}
