'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Lock } from '@/components/ui/icons'

// Signs the admin user out of their Supabase session entirely.
export function LockButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    if (busy) return
    setBusy(true)
    try {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
    } catch {
      // ignore — navigate regardless
    }
    router.replace('/login')
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-black/10 bg-surface px-3 text-sm font-medium text-muted shadow-sm transition-colors hover:text-ink hover:bg-black/[0.03] disabled:opacity-50"
    >
      <Lock className="w-4 h-4" aria-hidden />
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
