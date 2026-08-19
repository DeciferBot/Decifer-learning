'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BUDDY_ICONS } from '@/lib/icon-tokens'
import type { BuddyId } from '@/lib/customise-config'
import type { BuddyMood } from '@/lib/buddy-lines'

const MOOD_STYLE: Record<BuddyMood, { bg: string; ring: string; rotate: number; scale: number }> = {
  idle:         { bg: 'bg-black/[0.03]', ring: 'ring-black/10',    rotate: 0,   scale: 1 },
  happy:        { bg: 'bg-correct/15',   ring: 'ring-correct/40',  rotate: -6,  scale: 1.08 },
  excited:      { bg: 'bg-points-gold/20', ring: 'ring-points-gold/50', rotate: 8, scale: 1.14 },
  oops:         { bg: 'bg-incorrect/10', ring: 'ring-incorrect/30', rotate: 0,  scale: 0.96 },
  anticipation: { bg: 'bg-brand/15',     ring: 'ring-brand/40',    rotate: 0,   scale: 1.05 },
}

/**
 * The child's chosen study buddy, present through the quiz — reacting to each
 * answer and speaking the encouragement that used to only exist as static
 * on-screen text. Renders nothing if the child hasn't picked a buddy in
 * Customise: this is a companion on top of the quiz, never a requirement to
 * play it.
 */
export function StudyBuddy({
  buddyId,
  mood,
  line,
}: {
  buddyId: BuddyId | null
  mood: BuddyMood
  line: string | null
}) {
  const reduceMotion = useReducedMotion()
  if (!buddyId) return null

  const Icon = BUDDY_ICONS[buddyId]
  if (!Icon) return null

  const style = MOOD_STYLE[mood]

  return (
    <div className="flex items-center gap-3">
      <motion.div
        animate={
          reduceMotion
            ? { scale: 1, rotate: 0 }
            : { scale: style.scale, rotate: style.rotate }
        }
        transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-full ring-2 ${style.bg} ${style.ring}`}
      >
        <Icon size={22} className="text-ink" aria-hidden />
      </motion.div>

      {/* aria-live so a screen reader announces each new line once, without
          re-announcing the buddy's static presence on every render. */}
      <div className="min-h-[20px] flex-1" aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="wait">
          {line && (
            <motion.p
              key={line}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl bg-black/[0.03] px-3 py-1.5 text-sm font-semibold text-ink-2"
            >
              {line}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
