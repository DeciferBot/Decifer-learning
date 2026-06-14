'use client'

import { motion } from 'framer-motion'
import { Layers, Leaf, Search, Zap } from '@/components/ui/icons'

export type DifficultyChoice = 'sprout' | 'explorer' | 'lightning' | 'mixed'

const OPTIONS: {
  value: DifficultyChoice
  label: string
  icon: React.ReactNode
  desc: string
  color: string
}[] = [
  { value: 'mixed',     label: 'Mixed',     icon: <Layers className="w-6 h-6" aria-hidden />,  desc: 'A bit of everything',        color: '#6C9EFF' },
  { value: 'sprout',    label: 'Sprout',    icon: <Leaf className="w-6 h-6" aria-hidden />,    desc: 'Build your confidence',      color: '#A8E6CF' },
  { value: 'explorer',  label: 'Explorer',  icon: <Search className="w-6 h-6" aria-hidden />,  desc: 'Your normal level',          color: '#74C0FC' },
  { value: 'lightning', label: 'Lightning', icon: <Zap className="w-6 h-6" aria-hidden />,     desc: 'Push yourself',              color: '#FFD43B' },
]

export function DifficultyPicker({
  onPick,
}: {
  onPick: (choice: DifficultyChoice) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div>
        <h2 className="font-heading text-2xl font-bold text-ink">Choose your difficulty</h2>
        <p className="mt-1 text-sm text-muted">You can change this next time too.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <motion.button
            key={opt.value}
            whileTap={{ scale: 0.96 }}
            onClick={() => onPick(opt.value)}
            aria-label={`${opt.label} — ${opt.desc}`}
            className="flex min-h-[96px] flex-col items-start gap-1 rounded-2xl border-2 border-black/8 bg-surface p-4 text-left transition-colors hover:border-opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            style={{ '--hover-border': opt.color } as React.CSSProperties}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.borderColor = opt.color)
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.borderColor = '')
            }
          >
            <span style={{ color: opt.color }} aria-hidden>{opt.icon}</span>
            <span className="font-heading font-bold text-ink" aria-hidden>{opt.label}</span>
            <span className="text-xs text-muted" aria-hidden>{opt.desc}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
