'use client'

import { motion, AnimatePresence } from 'framer-motion'

export function HeartsDisplay({ hearts, max = 3 }: { hearts: number; max?: number }) {
  return (
    <div
      className="flex gap-1"
      role="img"
      aria-label={`${hearts} of ${max} hearts remaining`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <AnimatePresence key={i} mode="wait">
          {i < hearts ? (
            <motion.span
              key="full"
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="select-none text-xl"
              aria-hidden
            >
              ❤️
            </motion.span>
          ) : (
            <motion.span
              key="empty"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="select-none text-xl opacity-25"
              aria-hidden
            >
              🤍
            </motion.span>
          )}
        </AnimatePresence>
      ))}
    </div>
  )
}
