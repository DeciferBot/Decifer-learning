'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EarnedBadge } from '@/app/api/quiz/submit/route'
import { Star, Trophy, Flame, Swords, Medal } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

const BADGE_ICON: Record<string, { Icon: IconType; color: string }> = {
  'Topic Star':       { Icon: Star,    color: '#FFD43B' },
  'Perfect Score':    { Icon: Trophy,  color: '#FFC107' },
  'Subject Champion': { Icon: Trophy,  color: '#FB5A24' },
  'Streak 7':         { Icon: Flame,   color: '#FF6B6B' },
  'Guardian Slayer':  { Icon: Swords,  color: '#6C9EFF' },
}

const BADGE_TITLE_ID = 'badge-popup-title'

export function BadgePopup({
  badge,
  onDismiss,
}: {
  badge: EarnedBadge
  onDismiss: () => void
}) {
  const { Icon, color } = BADGE_ICON[badge.name] ?? { Icon: Medal, color: '#FFC107' }
  const dialogRef = useRef<HTMLDivElement>(null)

  // Move focus into dialog on mount; restore on unmount
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onDismiss])

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onDismiss}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-[51] flex items-center justify-center px-4 pointer-events-none">
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={BADGE_TITLE_ID}
          tabIndex={-1}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="w-full max-w-xs overflow-hidden rounded-3xl bg-surface p-8 text-center shadow-2xl outline-none pointer-events-auto"
          style={{ border: '3px solid #FFC107' }}
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
            Badge Unlocked!
          </p>

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260 }}
            className="mb-4 flex items-center justify-center"
            style={{ color }}
            aria-hidden="true"
          >
            <Icon size={72} />
          </motion.div>

          <h3 id={BADGE_TITLE_ID} className="mb-2 font-heading text-2xl font-bold text-ink">{badge.name}</h3>
          {badge.description && (
            <p className="mb-6 text-sm text-muted">{badge.description}</p>
          )}

          <button
            onClick={onDismiss}
            className="min-h-[48px] w-full rounded-xl bg-points-gold font-heading font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Awesome!
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
