'use client'

import { useEffect, useState } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'
import { CONSENT_CHANGED_EVENT, hasAnalyticsConsent } from '@/lib/consent'

// Consent-gated Google Analytics. The GA4 tag is only added to the page once
// the visitor has explicitly accepted analytics in the cookie banner — nothing
// loads or fires before that (privacy by default). Reacts live when consent
// changes, so accepting turns tracking on without a page reload.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function ConsentedAnalytics() {
  const [consented, setConsented] = useState(false)

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

  if (!GA_ID || !consented) return null
  return <GoogleAnalytics gaId={GA_ID} />
}
