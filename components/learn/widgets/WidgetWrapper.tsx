'use client'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface Props {
  title?: string
  instructions?: string
  completed?: boolean
  children: ReactNode
}

export function WidgetWrapper({ title, instructions, completed, children }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`my-6 rounded-2xl border-2 p-4 transition-colors ${
        completed
          ? 'border-correct/40 bg-correct/5'
          : 'border-maths/20 bg-surface'
      } shadow-sm`}
    >
      {title && (
        <h3 className="mb-1 font-heading text-base font-bold text-ink">{title}</h3>
      )}
      {instructions && (
        <p className="mb-4 text-sm text-muted">{instructions}</p>
      )}
      {children}
      {completed && (
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 text-center text-sm font-bold text-correct"
        >
          ✓ Well done!
        </motion.p>
      )}
    </motion.div>
  )
}
