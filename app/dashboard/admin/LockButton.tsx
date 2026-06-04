'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from '@/components/ui/icons'

// Ends the admin session by clearing the gate cookie, then returns to the unlock screen.
export function LockButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function lock() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/admin/unlock', { method: 'DELETE' })
    } catch {
      // ignore — navigate regardless
    }
    router.replace('/admin-unlock')
    // router.refresh() not needed — replace navigates away from admin entirely
  }

  return (
    <button
      type="button"
      onClick={lock}
      disabled={busy}
      className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-black/10 bg-surface px-3 text-sm font-medium text-muted shadow-sm transition-colors hover:text-ink hover:bg-black/[0.03] disabled:opacity-50"
    >
      <Lock className="w-4 h-4" aria-hidden />
      {busy ? 'Locking…' : 'Lock'}
    </button>
  )
}
