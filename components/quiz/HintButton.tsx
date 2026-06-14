'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb } from '@/components/ui/icons'

type Props = {
  hints: string[]
  revealed: string[]
  onReveal: () => void
  disabled: boolean
  // When non-null, hints are locked and the countdown (seconds remaining) is shown.
  // When null or 0, hints are unlocked and the normal button renders.
  countdown?: number | null
}

export function HintButton({ hints, revealed, onReveal, disabled, countdown }: Props) {
  if (hints.length === 0) return null

  const remaining = hints.length - revealed.length
  const isLocked = countdown !== null && countdown !== undefined && countdown > 0

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {revealed.map((hint, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden rounded-lg bg-lightning/20 px-4 py-2 text-sm text-ink"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              Hint {i + 1}:{' '}
            </span>
            {hint}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Locked — show countdown nudge */}
      {isLocked && remaining > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lightbulb size={14} className="flex-none" aria-hidden />
          Hint unlocks in{' '}
          <span className="tabular-nums font-bold">{countdown}s</span> — give it a try first!
        </p>
      )}

      {/* Unlocked — normal hint button */}
      {!disabled && !isLocked && remaining > 0 && (
        <button
          onClick={onReveal}
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-black/10 bg-surface px-4 text-sm font-semibold text-ink-2 transition-colors hover:bg-lightning/15 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Lightbulb size={16} className="flex-none" aria-hidden />
          {revealed.length === 0 ? 'Show hint' : 'Show another hint'} ({remaining} left)
        </button>
      )}

      {/* All hints used — tell the child why the button is gone */}
      {!disabled && !isLocked && remaining === 0 && revealed.length > 0 && (
        <p className="text-xs font-semibold text-ink-2">
          That&apos;s all the hints for this one — you&apos;ve got this!
        </p>
      )}
    </div>
  )
}
