'use client'

import { useState } from 'react'

type Props = {
  className?: string
  children?: React.ReactNode
}

export function UpgradeButton({ className, children }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
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
        {loading ? 'Redirecting to checkout…' : (children ?? 'Upgrade to Family — £7.99/mo')}
      </button>
      {error ? <p className="mt-2 text-center text-sm text-incorrect">{error}</p> : null}
    </div>
  )
}
