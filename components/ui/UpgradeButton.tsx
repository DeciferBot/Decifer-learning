'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/analytics'

type Props = {
  className?: string
  children?: React.ReactNode
  plan?: 'family' | 'per_child'
}

export function UpgradeButton({ className, children, plan = 'family' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) {
        // GA4 conversion: parent is heading to Stripe checkout.
        trackEvent('begin_checkout', { plan, currency: 'AED' })
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          'flex h-12 w-full items-center justify-center rounded-xl bg-maths font-semibold text-white transition active:scale-[0.98] disabled:opacity-60'
        }
      >
        {loading
          ? 'Redirecting to checkout…'
          : (children ??
            (plan === 'per_child'
              ? 'Choose Per Child — AED 350/child/mo'
              : 'Upgrade to Family — AED 500/mo'))}
      </button>
      {error ? <p className="mt-2 text-center text-sm text-incorrect">{error}</p> : null}
    </div>
  )
}
