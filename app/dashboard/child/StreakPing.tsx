'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame } from '@/components/ui/icons'

// Fire-and-forget streak update on dashboard mount (daily login tracking).
// Updates streak_days in the DB so the next server render shows the correct
// count. When the streak ticks up on a new day, we celebrate it in-line — the
// early days (1–7) are where the habit is won, so the win should feel seen.
export function StreakPing() {
  const [celebrate, setCelebrate] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/streak/check', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { streak_days?: number; updated?: boolean } | null) => {
        if (cancelled || !data?.updated || !data.streak_days) return
        setCelebrate(data.streak_days)
        setTimeout(() => !cancelled && setCelebrate(null), 4000)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const milestone = celebrate === 7 || celebrate === 30 || celebrate === 100

  return (
    <AnimatePresence>
      {celebrate !== null && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          role="status"
          className="flex items-center gap-3 rounded-2xl border-2 border-points-gold/40 bg-points-gold/10 px-4 py-3"
        >
          <Flame className="w-6 h-6 flex-none text-points-gold-700" aria-hidden />
          <div className="min-w-0">
            <p className="font-heading text-base font-extrabold text-points-gold-700">
              {celebrate === 1 ? 'Streak started!' : `${celebrate}-day streak!`}
            </p>
            <p className="text-xs text-muted">
              {milestone
                ? 'Amazing milestone, keep the run going!'
                : celebrate === 1
                  ? 'Come back tomorrow to keep it going.'
                  : 'You showed up again today. Brilliant.'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
