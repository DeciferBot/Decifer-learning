'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Handles all Supabase hash-based auth tokens that land on the root page:
//   type=recovery   → /reset-password (user needs to set a new password)
//   type=magiclink  → /dashboard (user is now signed in)
//   type=signup     → /dashboard (email confirmed, signed in)
// Without this, clicking any email link just shows the landing page.
export function RecoveryRedirect() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    if (hash.includes('type=recovery')) {
      router.replace('/reset-password' + hash)
      return
    }

    // Magic link / signup confirmation — wait for Supabase to process the
    // hash tokens, then send the user to their dashboard.
    const supabase = createSupabaseBrowserClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()
          router.replace('/dashboard')
        }
      }
    )
    // Calling getSession() kicks off hash processing if it hasn't run yet.
    supabase.auth.getSession()
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
