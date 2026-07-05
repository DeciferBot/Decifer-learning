'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  childId: string
  initialEnabled: boolean
}

export function PhysicalRewardsToggle({ childId, initialEnabled }: Props) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    if (saving) return
    const next = !enabled
    setEnabled(next)   // optimistic
    setSaving(true)
    setError(null)
    fetch(`/api/vault/parent/settings/${childId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ physicalRewardsEnabled: next }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json()
          setError(body.error ?? 'Could not update — please try again')
          setEnabled(!next)  // roll back
        } else {
          router.refresh()
        }
      })
      .catch(() => { setError('Network error — please try again'); setEnabled(!next) })
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Physical prizes</p>
          <p className="text-xs text-muted">
            {enabled
              ? 'You can pick a prize from your family catalogue when approving a request.'
              : 'Enable to pick prizes from your family catalogue when approving rewards.'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          className={`relative flex h-7 w-12 flex-none items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${
            enabled ? 'bg-brand' : 'bg-black/15'
          }`}
        >
          <span
            className={`absolute h-5 w-5 rounded-full bg-surface shadow-sm transition-transform duration-200 ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          <span className="sr-only">{enabled ? 'Disable physical prizes' : 'Enable physical prizes'}</span>
        </button>
      </div>
      {error && <p className="text-xs text-incorrect">{error}</p>}
    </div>
  )
}
