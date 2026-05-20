'use client'

import { useEffect } from 'react'

// Fire-and-forget streak update on dashboard mount (daily login tracking).
// Updates streak_days in the DB so the next server render shows the correct count.
export function StreakPing() {
  useEffect(() => {
    fetch('/api/streak/check', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
