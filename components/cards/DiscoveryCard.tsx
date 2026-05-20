'use client'

import { RARITY_COLOUR, RARITY_LABEL, RARITY_EMOJI, type Rarity } from '@/lib/cards'

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
  const emoji = RARITY_EMOJI[rarity] ?? '🌿'

  if (!collected) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-black/10 bg-black/5"
        style={{ filter: 'grayscale(1)', minHeight: compact ? 120 : 160 }}
        aria-label="Undiscovered card"
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="text-3xl opacity-30">?</span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold opacity-40"
            style={{ background: colour }}
          >
            {label}
          </span>
          <p className="text-xs font-bold text-muted opacity-50">Undiscovered</p>
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
          <span className="text-lg">{emoji}</span>
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
