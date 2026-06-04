'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  requestId: string
}

export function FulfillButton({ requestId }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted">Mark as given?</span>
        <button
          onClick={async () => {
            setSubmitting(true)
            setError(null)
            try {
              const res = await fetch('/api/vault/parent/fulfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId }),
              })
              if (!res.ok) {
                const body = await res.json()
                setError(body.error ?? 'Something went wrong')
                setConfirming(false)
                return
              }
              setConfirming(false)
              router.refresh()
            } finally {
              setSubmitting(false)
            }
          }}
          disabled={submitting}
          className="rounded-lg bg-correct/15 px-3 py-1 text-xs font-bold text-correct hover:bg-correct/25 disabled:opacity-60"
        >
          {submitting ? '…' : 'Yes, done'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg bg-black/5 px-3 py-1 text-xs font-bold text-muted hover:bg-black/10"
        >
          Not yet
        </button>
        {error && <span className="text-xs text-incorrect">{error}</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg bg-correct/10 px-3 py-1 text-xs font-bold text-correct hover:bg-correct/20 whitespace-nowrap"
    >
      ✓ Mark as done
    </button>
  )
}
