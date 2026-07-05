'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { readConsent, setConsent } from '@/lib/consent'

// Cookie / analytics consent banner.
//
// Essential cookies (login, preferences) always apply — they're needed for the
// service to work. Analytics (Google Analytics) is optional and only runs if the
// visitor accepts here. Declining means GA is never loaded (see ConsentedAnalytics).
export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show the banner only until a choice (accept OR decline) has been recorded.
    if (readConsent() === null) setVisible(true)
  }, [])

  function choose(value: 'accepted' | 'declined') {
    setConsent(value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie and analytics consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/10 bg-surface px-4 py-4 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:rounded-xl sm:border"
      // Keep the buttons clear of the iOS home indicator when docked at bottom-0.
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <p className="text-sm leading-relaxed text-ink">
        We use essential cookies to keep you logged in and remember your preferences. With your
        consent, we also use Google Analytics to understand how the site is used. You can decline
        analytics and everything still works.{' '}
        <Link href="/legal/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
          Privacy policy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => choose('declined')}
          className="flex h-10 flex-1 items-center justify-center rounded-lg border border-black/15 bg-surface text-sm font-semibold text-ink transition active:scale-[0.98]"
        >
          Decline analytics
        </button>
        <button
          onClick={() => choose('accepted')}
          className="flex h-10 flex-1 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
