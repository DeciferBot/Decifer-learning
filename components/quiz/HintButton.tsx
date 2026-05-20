'use client'

import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  hints: string[]
  revealed: string[]
  onReveal: () => void
  disabled: boolean
}

export function HintButton({ hints, revealed, onReveal, disabled }: Props) {
  if (hints.length === 0) return null

  const remaining = hints.length - revealed.length

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

      {!disabled && remaining > 0 && (
        <button
          onClick={onReveal}
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          {revealed.length === 0 ? 'Show hint' : 'Show another hint'} ({remaining} left)
        </button>
      )}
    </div>
  )
}
