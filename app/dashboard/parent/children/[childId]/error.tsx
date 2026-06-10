'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ChildDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[child detail error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-4">
      <h1 className="font-heading text-2xl font-bold text-ink">Something went wrong</h1>
      <p className="text-sm text-muted max-w-sm">
        We hit an unexpected error loading this child&apos;s report. Your data is safe.
        {error.digest ? ` (ref: ${error.digest})` : ''}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-maths px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maths/90 min-h-[44px]"
        >
          Try again
        </button>
        <Link
          href="/dashboard/parent"
          className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-black/5 min-h-[44px] inline-flex items-center"
        >
          Back to overview
        </Link>
      </div>
    </div>
  )
}
