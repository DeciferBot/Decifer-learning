'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks the user's `prefers-reduced-motion` setting (CLAUDE.md §11 — MVA11y
 * basics include respecting reduced motion). Returns true when motion should be
 * minimised: explorers freeze orbital animation and disable camera fly-tos.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
