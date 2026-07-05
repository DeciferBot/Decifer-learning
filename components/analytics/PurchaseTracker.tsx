'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics'

// Fires a GA4 `purchase` event when a parent returns from Stripe checkout.
// Stripe redirects to /dashboard/parent?upgraded=1&plan=...&value=...&session_id=...
// (see app/api/stripe/checkout/route.ts success_url).
//
// Reads straight from window.location (not useSearchParams) so it needs no
// Suspense boundary. Dedupes per checkout session via sessionStorage so a page
// refresh doesn't double-count, then strips the params from the URL.
function stripTrackingParams(): void {
  const url = new URL(window.location.href)
  ;['upgraded', 'session_id', 'plan', 'value'].forEach((k) => url.searchParams.delete(k))
  window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
}

export function PurchaseTracker() {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded') !== '1') return
    fired.current = true

    const sessionId = params.get('session_id') ?? undefined
    const plan = params.get('plan') ?? undefined
    const rawValue = params.get('value')
    const value = rawValue !== null && rawValue !== '' ? Number(rawValue) : undefined

    const dedupKey = sessionId ? `ga_purchase_${sessionId}` : null
    try {
      if (dedupKey && window.sessionStorage.getItem(dedupKey)) {
        stripTrackingParams()
        return
      }
    } catch {
      // sessionStorage unavailable (private mode) — proceed without dedupe.
    }

    trackEvent('purchase', {
      transaction_id: sessionId,
      currency: 'AED',
      value: Number.isFinite(value) ? value : undefined,
      items: plan ? [{ item_id: plan, item_name: plan }] : undefined,
    })

    try {
      if (dedupKey) window.sessionStorage.setItem(dedupKey, '1')
    } catch {
      // ignore
    }
    stripTrackingParams()
  }, [])

  return null
}
