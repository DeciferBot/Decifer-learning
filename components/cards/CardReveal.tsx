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

// CSS token aliases for each rarity — avoids hardcoded hex
const RARITY_TOKEN: Record<Rarity, { bg: string; border: string; text: string; pill: string }> = {
  common:    { bg: 'var(--common-bg)',    border: 'var(--common-bdr)',    text: 'var(--common)',    pill: 'var(--common-bg)'    },
  uncommon:  { bg: 'var(--uncommon-bg)',  border: 'var(--uncommon-bdr)',  text: 'var(--uncommon)',  pill: 'var(--uncommon-bg)'  },
  rare:      { bg: 'var(--rare-bg)',      border: 'var(--rare-bdr)',      text: 'var(--rare)',      pill: 'var(--rare-bg)'      },
  epic:      { bg: 'var(--epic-bg)',      border: 'var(--epic-bdr)',      text: 'var(--epic)',      pill: 'var(--epic-bg)'      },
  legendary: { bg: 'var(--legendary-bg)', border: 'var(--legendary-bdr)', text: 'var(--legendary)', pill: 'var(--legendary-bg)' },
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
  const tokens = RARITY_TOKEN[rarity] ?? RARITY_TOKEN.common
  const RarityIcon: IconType = RARITY_ICON[rarity] ?? Leaf

  const isLegendary = rarity === 'legendary'
  const isEpic = rarity === 'epic'
  const isSpecial = isEpic || isLegendary

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
        style={{ background: 'var(--overlay)' }}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.88 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden"
          style={{
            borderRadius: 'var(--radius-modal)',
            background: 'var(--surface)',
            border: `3px solid ${tokens.border}`,
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          {/* Legendary shimmer bar */}
          {isLegendary ? (
            <motion.div
              className="h-2 w-full"
              style={{ background: 'var(--legendary-gradient)' }}
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <div className="h-2 w-full" style={{ background: colour }} />
          )}

          {/* Legendary full-card shimmer overlay */}
          {isLegendary && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,215,0,0.12) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
            />
          )}

          <div className="relative z-20 p-6 text-center">
            <p
              className="mb-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
            >
              {card.isNew ? 'New card discovered!' : 'Card collected!'}
            </p>

            <motion.div
              initial={{ scale: 0.4, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{
                delay: 0.15,
                type: 'spring',
                stiffness: isLegendary ? 220 : 280,
                damping: isLegendary ? 14 : 20,
              }}
              className="mb-3 flex items-center justify-center"
              style={{ color: tokens.text }}
            >
              {isLegendary ? (
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                >
                  <RarityIcon size={72} />
                </motion.div>
              ) : (
                <RarityIcon size={64} />
              )}
            </motion.div>

            {/* Rarity pill */}
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.28 }}
              className="mb-3 inline-block px-3 py-1 text-xs font-bold"
              style={{
                background: tokens.pill,
                color: tokens.text,
                borderRadius: 'var(--radius-pill)',
                border: `1px solid ${tokens.border}`,
                fontFamily: 'var(--font-display)',
              }}
            >
              {label} Discovery Card
            </motion.span>

            <h3
              className="mb-3 text-xl font-extrabold"
              style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)' }}
            >
              {card.title}
            </h3>

            {isSpecial && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-3 flex items-center justify-center gap-1.5 text-sm font-bold"
                style={{ color: tokens.text, fontFamily: 'var(--font-display)' }}
              >
                <Sparkles size={14} aria-hidden />
                {isLegendary ? 'Legendary find!' : 'Epic discovery!'}
                <Sparkles size={14} aria-hidden />
              </motion.div>
            )}

            <p
              className="mb-6 text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)', lineHeight: 'var(--lh-body-sm)' }}
            >
              {card.fact_text}
            </p>

            <button
              onClick={onDismiss}
              className="min-h-[48px] w-full font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                background: isLegendary ? 'var(--legendary-gradient)' : colour,
                borderRadius: 'var(--radius-button)',
                fontSize: 'var(--fs-label-lg)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Collect it!
            </button>

            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Pass another quiz to win your next card
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
