'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSignOut(): void {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="h-12 min-w-[48px] rounded-lg border border-black/10 bg-white px-3 text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
