'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  requestId: string
  currentStatus: string   // 'approved' | 'dispatched' | 'delivered'
}

const NEXT_STATUS: Record<string, { label: string; status: string }> = {
  approved:   { label: 'Mark dispatched',  status: 'dispatched' },
  dispatched: { label: 'Mark delivered',   status: 'delivered'  },
}

export function FulfilmentControls({ requestId, currentStatus }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackingInput, setTrackingInput] = useState('')
  const [showTracking, setShowTracking] = useState(false)

  const next = NEXT_STATUS[currentStatus]
  if (!next) return null   // 'delivered' — nothing further

  async function advance() {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, string> = { status: next.status }
      if (trackingInput.trim()) body.tracking_number = trackingInput.trim()

      const res = await fetch(`/api/admin/vault/fulfilment/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not update — please try again')
        return
      }
      setShowTracking(false)
      setTrackingInput('')
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      {next.status === 'dispatched' && (
        <div className="flex items-center gap-2">
          {showTracking ? (
            <input
              type="text"
              placeholder="Tracking number (optional)"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              maxLength={80}
              className="flex-1 rounded-lg border border-black/10 bg-surface px-2.5 py-1 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setShowTracking(true)}
              className="text-xs text-muted hover:text-ink underline underline-offset-2"
            >
              + add tracking number
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={advance}
          disabled={saving}
          className="rounded-lg bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/20 disabled:opacity-50 min-h-[32px] min-w-[120px]"
        >
          {saving ? 'Saving…' : next.label}
        </button>
      </div>
      {error && <p className="text-xs text-incorrect">{error}</p>}
    </div>
  )
}
