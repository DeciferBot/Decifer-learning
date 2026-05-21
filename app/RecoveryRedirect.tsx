'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Handles all Supabase auth tokens that land on the root page:
//
//   PKCE flow  → ?code=xxx  (magic link / OAuth routed via the app's own flow)
//   Hash flow  → #access_token=xxx  (OTP magic link sent from Supabase dashboard)
//
// Token types handled:
//   type=recovery   → /reset-password  (user needs to set a new password)
//   type=magiclink  → /dashboard       (user is now signed in)
//   type=signup     → /dashboard       (email confirmed, signed in)
//
// Event note: auth-js 2.x fires INITIAL_SESSION (not SIGNED_IN) when a
// new onAuthStateChange subscriber registers after the session is already
// resolved from the URL. We handle both to avoid the race condition.
export function RecoveryRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const hash = window.location.hash

    // ── PKCE flow: forward ?code to the proper callback handler ──────────
    if (code) {
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}`)
      return
    }

    // ── Hash / implicit flow: handle #access_token from OTP magic links ──
    if (!hash.includes('access_token=')) return

    if (hash.includes('type=recovery')) {
      router.replace('/reset-password' + hash)
      return
    }

    // Magic link or signup confirmation.
    // Listen for SIGNED_IN *and* INITIAL_SESSION — auth-js 2.x emits
    // INITIAL_SESSION to subscribers that register after the session has
    // already been resolved from the URL hash.
    const supabase = createSupabaseBrowserClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          subscription.unsubscribe()
          router.replace('/dashboard')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, searchParams])

  return null
}
