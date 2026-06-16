'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'decifer_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // localStorage not available (SSR or private browsing)
    }
  }, [])

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted')
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/10 bg-surface px-4 py-4 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:rounded-xl sm:border"
      // Keep the button clear of the iOS home indicator when docked at bottom-0.
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <p className="text-sm leading-relaxed text-ink">
        We use essential cookies to keep you logged in and remember your preferences. No tracking
        or advertising cookies.{' '}
        <Link href="/legal/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
          Privacy policy
        </Link>
      </p>
      <button
        onClick={accept}
        className="mt-3 flex h-10 w-full items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white transition active:scale-[0.98]"
      >
        Got it
      </button>
    </div>
  )
}
