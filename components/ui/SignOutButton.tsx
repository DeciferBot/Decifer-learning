'use client'

import { useTransition } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const [isPending, startTransition] = useTransition()

  function handleSignOut(): void {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
      // Hard navigation: a client-side router.push() can leave the shared
      // dashboard layout (and its TopBar) served from a Router Cache entry
      // captured under the outgoing session's cookie.
      window.location.href = '/login'
    })
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="h-12 min-w-[48px] rounded-lg border border-black/10 bg-surface px-3 text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
