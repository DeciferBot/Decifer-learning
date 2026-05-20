'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { EarnedBadge } from '@/app/api/quiz/submit/route'

const BADGE_EMOJI: Record<string, string> = {
  'Topic Star':        '⭐',
  'Perfect Score':     '💯',
  'Subject Champion':  '🏆',
  'Streak 7':          '🔥',
  'Guardian Slayer':   '⚔️',
}

export function BadgePopup({
  badge,
  onDismiss,
}: {
  badge: EarnedBadge
  onDismiss: () => void
}) {
  const emoji = BADGE_EMOJI[badge.name] ?? '🏅'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs overflow-hidden rounded-3xl bg-surface p-8 text-center shadow-2xl"
          style={{ border: '3px solid #FFC107' }}
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
            Badge Unlocked!
          </p>

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260 }}
            className="mb-4 text-7xl"
          >
            {emoji}
          </motion.div>

          <h3 className="mb-2 font-heading text-2xl font-bold text-ink">{badge.name}</h3>
          {badge.description && (
            <p className="mb-6 text-sm text-muted">{badge.description}</p>
          )}

          <button
            onClick={onDismiss}
            className="min-h-[48px] w-full rounded-xl bg-points-gold font-heading font-bold text-white transition-opacity hover:opacity-90"
          >
            Awesome!
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
