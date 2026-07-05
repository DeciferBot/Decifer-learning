'use client'

import Link from 'next/link'
import { useState } from 'react'

type Props = {
  plan: string            // 'free' | 'family'
  status: string | null   // 'active' | 'past_due' | 'canceled' | null
  periodEnd: string | null // ISO date string or null
}

export function SubscriptionStatus({ plan, status, periodEnd }: Props) {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(false)
  }

  const isFree = plan === 'free' || !plan
  const isPastDue = status === 'past_due'
  const formattedEnd = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  if (isFree) {
    return (
      <div className="rounded-2xl border border-maths/20 bg-maths/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-maths">Free plan</p>
            <p className="mt-1 text-sm text-muted">
              3 Maths topics. Upgrade to unlock all subjects and year groups.
            </p>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 rounded-lg bg-maths px-4 py-2 text-sm font-semibold text-white transition hover:bg-maths/90"
          >
            Upgrade
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 ${isPastDue ? 'border-incorrect/30 bg-incorrect/5' : 'border-correct/20 bg-correct/5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wide ${isPastDue ? 'text-incorrect' : 'text-correct'}`}>
            Family plan {isPastDue ? '— Payment failed' : '— Active'}
          </p>
          <p className="mt-1 text-sm text-muted">
            All subjects · Year 1–11 · Unlimited children
            {formattedEnd && !isPastDue ? ` · Renews ${formattedEnd}` : ''}
          </p>
          {isPastDue && (
            <p className="mt-1 text-sm font-semibold text-incorrect">
              Update your payment method to keep access.
            </p>
          )}
        </div>
        <button
          onClick={openPortal}
          disabled={loading}
          className="shrink-0 rounded-lg border border-black/10 bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-black/5 disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Manage'}
        </button>
      </div>
    </div>
  )
}
