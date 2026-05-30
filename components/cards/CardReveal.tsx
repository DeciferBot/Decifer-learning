'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { RARITY_COLOUR, RARITY_LABEL, type Rarity } from '@/lib/cards'
import { Leaf, Compass, Star, Gem, Crown, Sparkles } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'
import type { DroppedCard } from '@/app/api/quiz/submit/route'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

const RARITY_ICON: Record<Rarity, IconType> = {
  common:    Leaf,
  uncommon:  Compass,
  rare:      Star,
  epic:      Gem,
  legendary: Crown,
}

export function CardReveal({
  card,
  onDismiss,
}: {
  card: DroppedCard
  onDismiss: () => void
}) {
  const rarity = card.rarity as Rarity
  const colour = RARITY_COLOUR[rarity] ?? '#A8E6CF'
  const label = RARITY_LABEL[rarity] ?? card.rarity
  const RarityIcon: IconType = RARITY_ICON[rarity] ?? Leaf

  const isSpecial = rarity === 'epic' || rarity === 'legendary'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-2xl"
          style={{ border: `3px solid ${colour}` }}
        >
          {/* Shimmer bar */}
          <div className="h-1.5 w-full" style={{ background: colour }} />

          <div className="p-6 text-center">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">
              {card.isNew ? 'New card discovered!' : 'Card collected!'}
            </p>

            <motion.div
              initial={{ scale: 0.5, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 280 }}
              className="mb-3 flex items-center justify-center"
              style={{ color: colour }}
            >
              <RarityIcon size={64} />
            </motion.div>

            {/* Rarity pill */}
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: colour + '40' }}
            >
              {label} Discovery Card
            </span>

            <h3 className="mb-3 font-heading text-xl font-bold text-ink">{card.title}</h3>

            {isSpecial && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-3 text-sm font-bold"
                style={{ color: colour }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles size={14} />
                  {rarity === 'legendary' ? 'Legendary find!' : 'Epic discovery!'}
                  <Sparkles size={14} />
                </span>
              </motion.div>
            )}

            <p className="mb-6 text-sm leading-relaxed text-muted">{card.fact_text}</p>

            <button
              onClick={onDismiss}
              className="min-h-[48px] w-full rounded-xl font-heading font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: colour }}
            >
              Collect it!
            </button>
            <p className="mt-3 text-xs text-muted">
              Pass another quiz to win your next card 🃏
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
