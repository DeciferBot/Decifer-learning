import { sendGAEvent } from '@next/third-parties/google'

// Thin, safe wrapper around GA4 event tracking (client-side only).
//
// Only fires when NEXT_PUBLIC_GA_MEASUREMENT_ID is set at build time — the same
// gate the <GoogleAnalytics> tag in app/layout.tsx uses. If GA is absent or
// blocked, this is a silent no-op: analytics must never break a user flow.
//
// Import this ONLY from Client Components ('use client'), because sendGAEvent
// pushes to the browser dataLayer.
const GA_ENABLED = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!GA_ENABLED || typeof window === 'undefined') return
  try {
    sendGAEvent('event', name, params)
  } catch {
    // GA not yet initialised, or blocked by the browser — ignore.
  }
}
