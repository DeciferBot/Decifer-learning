'use client'

// Error boundary for every /explore route (the index + each explorer).
// A stale client requesting an old route chunk after a deploy throws a
// ChunkLoadError that would otherwise dead-end on Next's bare "Application
// error" screen. Here we auto-recover from those, and for any other error show
// a calm, on-brand retry instead of a white screen.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { recoverFromChunkError } from '@/lib/client-recovery'

export default function ExploreError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [recovering, setRecovering] = useState(true)

  useEffect(() => {
    // Try the silent self-heal first; if it can't (or already tried), fall
    // through to the manual retry UI.
    if (!recoverFromChunkError(error)) setRecovering(false)
  }, [error])

  if (recovering) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: '#04060f' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        <p className="text-sm text-white/60">Updating to the latest version…</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#04060f' }}>
      <p className="text-5xl">🔭</p>
      <p className="font-heading text-lg font-bold text-white">This explorer hit a snag</p>
      <p className="max-w-xs text-sm text-white/50">It’s not you. Let’s try loading it again.</p>
      <div className="mt-2 flex flex-col items-center gap-3">
        <button
          onClick={() => { setRecovering(true); reset() }}
          className="rounded-full px-6 text-sm font-bold text-white active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #6C9EFF, #a78bfa)', minHeight: 48 }}
        >
          Try again
        </button>
        <Link href="/explore" className="rounded-full bg-surface/10 px-5 py-2 text-sm font-semibold text-white/70" style={{ minHeight: 40 }}>
          ← Back to Explore
        </Link>
      </div>
    </div>
  )
}
