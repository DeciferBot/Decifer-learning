'use client'

import { useEffect, useState } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'
import { CONSENT_CHANGED_EVENT, hasAnalyticsConsent } from '@/lib/consent'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getUserRole } from '@/lib/auth/roles'

// Consent-gated Google Analytics with an extra child-safety rule.
//
// GA4 loads only when ALL of these hold:
//   1. a measurement ID is configured,
//   2. the visitor has explicitly accepted analytics, AND
//   3. the session is NOT a signed-in child.
//
// (3) exists because a child cannot give valid consent for third-party analytics
// under the UK Children's Code / GDPR (that needs a parent/guardian). So we never
// run GA on a child's session, even if "Accept" was clicked. First-party Vercel
// Analytics still applies. Nothing loads or fires before consent (privacy by
// default), and login/logout re-evaluates live.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function ConsentedAnalytics() {
  const [consented, setConsented] = useState(false)
  // null = role not yet determined; hold GA off until we know it's not a child.
  const [isChild, setIsChild] = useState<boolean | null>(null)

  useEffect(() => {
    const sync = () => setConsented(hasAnalyticsConsent())
    sync()
    window.addEventListener(CONSENT_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    try {
      const supabase = createSupabaseBrowserClient()
      // getSession() reads the locally stored session (no network). Used only to
      // switch analytics OFF for children, so it needs no server revalidation.
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return
        const user = data.session?.user
        setIsChild(user ? getUserRole(user) === 'child' : false)
      })
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return
        setIsChild(session?.user ? getUserRole(session.user) === 'child' : false)
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    } catch {
      // Supabase unavailable — treat as a non-child visitor; consent still gates GA.
      setIsChild(false)
    }
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  if (!GA_ID || !consented || isChild === null || isChild) return null
  return <GoogleAnalytics gaId={GA_ID} />
}
