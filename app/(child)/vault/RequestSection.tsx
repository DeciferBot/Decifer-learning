'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  hasCredits: boolean
  hasPendingRequest: boolean
  pendingRequest: {
    id: string
    status: string
    childMessage: string | null
    parentResponseNote: string | null
    createdAt: string
  } | null
  familyRewardOptions: Array<{ label: string }>
}

const STATUS_COPY: Record<string, { label: string; description: string; colour: string }> = {
  pending: {
    label: 'Waiting for parent',
    description: "Your request has been sent. We'll let you know when your parent responds.",
    colour: 'text-points-gold',
  },
  deferred: {
    label: 'Saved for later',
    description: 'Your parent has seen your request and will get back to you soon — hang tight!',
    colour: 'text-muted',
  },
  counter_offered: {
    label: 'Parent has a suggestion',
    description: 'Your parent has a different reward idea for you. See the message below.',
    colour: 'text-maths',
  },
}

export function RequestSection({ hasCredits, hasPendingRequest, pendingRequest, familyRewardOptions }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/vault/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Something went wrong — please try again.')
        return
      }
      setDone(true)
      setMessage('')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  // Show pending request status card if one exists
  if (hasPendingRequest && pendingRequest) {
    const info = STATUS_COPY[pendingRequest.status]
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⏳</span>
          <span className={`font-heading text-sm font-bold ${info?.colour ?? 'text-ink'}`}>
            {info?.label ?? pendingRequest.status}
          </span>
        </div>
        {info && <p className="text-sm text-muted">{info.description}</p>}
        {pendingRequest.childMessage && (
          <div className="rounded-xl bg-black/5 p-3">
            <p className="text-xs text-muted mb-0.5">Your message</p>
            <p className="text-sm text-ink">&ldquo;{pendingRequest.childMessage}&rdquo;</p>
          </div>
        )}
        {pendingRequest.status === 'counter_offered' && pendingRequest.parentResponseNote && (
          <div className="rounded-xl bg-maths/10 p-3">
            <p className="text-xs text-muted mb-0.5">Parent&apos;s suggestion</p>
            <p className="text-sm text-ink">&ldquo;{pendingRequest.parentResponseNote}&rdquo;</p>
            <div className="mt-3 flex gap-2">
              <button
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-correct text-sm font-bold text-white transition-colors hover:opacity-90"
                onClick={async () => {
                  await fetch('/api/vault/parent/respond', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId: pendingRequest.id, action: 'accept_counter' }),
                  })
                  router.refresh()
                }}
              >
                Accept ✓
              </button>
              <button
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-ink transition-colors hover:bg-black/10"
                onClick={async () => {
                  await fetch('/api/vault/parent/respond', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId: pendingRequest.id, action: 'dismiss_counter' }),
                  })
                  router.refresh()
                }}
              >
                No thanks
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!hasCredits) {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm text-center space-y-1">
        <p className="text-2xl" aria-hidden>🔒</p>
        <p className="text-sm font-semibold text-ink">Keep going to unlock a reward</p>
        <p className="text-xs text-muted">
          Reach your next milestone and a reward will be waiting for you.
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-correct/20 bg-correct/5 p-5 text-center">
        <p className="text-2xl mb-2">🎉</p>
        <p className="font-heading font-bold text-ink">Request sent!</p>
        <p className="mt-1 text-sm text-muted">Your parent will be notified.</p>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full min-h-[52px] items-center justify-center rounded-2xl bg-brand px-5 font-heading text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-600 active:scale-[0.98]"
      >
        🎁 Ask for a reward
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-xl space-y-4">
            <h2 className="font-heading text-lg font-bold text-ink">What would you like?</h2>

            {familyRewardOptions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {familyRewardOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setMessage(opt.label)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        message === opt.label
                          ? 'border-brand bg-brand text-white'
                          : 'border-black/10 text-ink hover:border-brand/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted">
                Message (optional)
              </label>
              <textarea
                className="w-full resize-none rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
                rows={3}
                maxLength={120}
                placeholder="Add a message to your parent…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-muted">{message.length}/120</p>
            </div>

            {error && (
              <p className="rounded-xl bg-incorrect/10 px-3 py-2 text-sm text-incorrect">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setOpen(false); setError(null) }}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-black/5 text-sm font-bold text-ink transition-colors hover:bg-black/10"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-brand text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
