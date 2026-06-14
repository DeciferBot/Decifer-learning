'use client'

import { RARITY_COLOUR, RARITY_LABEL, type Rarity } from '@/lib/cards'
import { Leaf, Compass, Star, Gem, Crown, Lock } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

const RARITY_ICON: Record<Rarity, IconType> = {
  common:    Leaf,
  uncommon:  Compass,
  rare:      Star,
  epic:      Gem,
  legendary: Crown,
}

export type CardData = {
  id: string
  title: string
  fact_text: string
  rarity: string
}

export function DiscoveryCard({
  card,
  collected = true,
  compact = false,
}: {
  card: CardData
  collected?: boolean
  compact?: boolean
}) {
  const rarity = card.rarity as Rarity
  const colour = RARITY_COLOUR[rarity] ?? '#A8E6CF'
  const label = RARITY_LABEL[rarity] ?? card.rarity
  const RarityIcon: IconType = RARITY_ICON[rarity] ?? Leaf

  if (!collected) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border-2"
        style={{
          borderColor: colour + '50',
          minHeight: compact ? 120 : 160,
          background: colour + '12',
        }}
        aria-label={`Undiscovered ${label} card`}
      >
        <div className="absolute inset-x-0 top-0 h-1 opacity-40" style={{ background: colour }} />

        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="opacity-10 select-none" style={{ color: colour }} aria-hidden="true">
            <RarityIcon size={40} />
          </span>
          <span className="text-muted" aria-hidden="true">
            <Lock size={18} />
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ background: colour + '30', color: '#2D3748' }}
          >
            {label}
          </span>
          {!compact && (
            <p className="text-xs font-semibold" style={{ color: colour }}>
              Pass a quiz to unlock
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2"
      style={{ borderColor: colour, minHeight: compact ? 120 : 160 }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: colour }} />
      <div className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span style={{ color: colour }} aria-hidden="true">
            <RarityIcon size={18} />
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ background: colour + '40', color: '#2D3748' }}
          >
            {label}
          </span>
        </div>
        <p className="font-heading text-sm font-bold leading-snug text-ink">{card.title}</p>
        {!compact && (
          <p className="flex-1 text-xs leading-relaxed text-muted">{card.fact_text}</p>
        )}
      </div>
    </div>
  )
}
