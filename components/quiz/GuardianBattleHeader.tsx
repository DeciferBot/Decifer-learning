'use client'

import { motion } from 'framer-motion'
import { Swords, Shield } from '@/components/ui/icons'

type Props = {
  zoneName: string
  questionCount: number
}

export function GuardianBattleHeader({ zoneName, questionCount }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-8 text-center"
      style={{
        background: 'var(--guardian-dark)',
        boxShadow: 'var(--shadow-guardian)',
      }}
    >
      {/* Subtle radial glow behind icon */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden
      >
        <div
          className="h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--guardian)' }}
        />
      </div>

      <div className="relative">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
          className="mb-4 flex items-center justify-center"
          style={{ color: 'var(--legendary)' }}
          aria-hidden
        >
          <Swords size={56} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-1 text-xs font-bold uppercase tracking-widest"
          style={{ color: 'var(--guardian-bdr)', fontFamily: 'var(--font-display)' }}
        >
          {zoneName}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="font-heading text-2xl font-extrabold"
          style={{
            color: 'var(--text-inverse)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.01em',
          }}
        >
          Zone Guardian
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-2 flex items-center justify-center gap-2 text-sm"
          style={{ color: 'var(--guardian-bdr)' }}
        >
          <Shield size={14} aria-hidden />
          {questionCount} questions: defeat them all to claim a Legendary card
        </motion.p>
      </div>
    </div>
  )
}
