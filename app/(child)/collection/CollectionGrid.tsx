'use client'

import { useState } from 'react'
import { DiscoveryCard, type CardData } from '@/components/cards/DiscoveryCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Layers } from '@/components/ui/icons'
import Link from 'next/link'

type CardWithMeta = CardData & { subject_id?: string | null }

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
type Rarity = typeof RARITY_ORDER[number]

const RARITY_TOKEN: Record<Rarity, { text: string; bg: string; border: string; label: string }> = {
  common:    { text: 'var(--common)',    bg: 'var(--common-bg)',    border: 'var(--common-bdr)',    label: 'Common'    },
  uncommon:  { text: 'var(--uncommon)',  bg: 'var(--uncommon-bg)',  border: 'var(--uncommon-bdr)',  label: 'Uncommon'  },
  rare:      { text: 'var(--rare)',      bg: 'var(--rare-bg)',      border: 'var(--rare-bdr)',      label: 'Rare'      },
  epic:      { text: 'var(--epic)',      bg: 'var(--epic-bg)',      border: 'var(--epic-bdr)',      label: 'Epic'      },
  legendary: { text: 'var(--legendary)', bg: 'var(--legendary-bg)', border: 'var(--legendary-bdr)', label: 'Legendary' },
}

type Subject = { id: string; name: string; colour_token: string }

type Props = {
  cards: CardWithMeta[]
  ownedSet: Set<string>
  subjects: Subject[]
  totalCards: number
  collectedCount: number
}

export function CollectionGrid({ cards, ownedSet, subjects, totalCards, collectedCount }: Props) {
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string | 'all'>('all')

  const filtered = cards.filter((c) => {
    if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
    if (subjectFilter !== 'all' && c.subject_id !== subjectFilter) return false
    return true
  })

  const sorted = [...filtered].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity as Rarity) - RARITY_ORDER.indexOf(b.rarity as Rarity),
  )

  const pct = totalCards > 0 ? Math.round((collectedCount / totalCards) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {collectedCount} / {totalCards} cards discovered
          </p>
          <span className="text-xs font-bold" style={{ color: 'var(--xp)', fontFamily: 'var(--font-display)' }}>
            {pct}%
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden"
          style={{ background: 'var(--border-default)', borderRadius: 'var(--radius-pill)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Collection completion"
        >
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'var(--legendary-gradient)', borderRadius: 'var(--radius-pill)' }}
          />
        </div>
      </div>

      {/* Rarity filter pills */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
          Rarity
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterPill
            active={rarityFilter === 'all'}
            onClick={() => setRarityFilter('all')}
            bg="var(--surface-raised)"
            activeBg="var(--text-primary)"
            text="var(--text-secondary)"
            activeText="var(--text-inverse)"
            border="var(--border-default)"
          >
            All
          </FilterPill>
          {RARITY_ORDER.map((r) => {
            const t = RARITY_TOKEN[r]
            const count = cards.filter((c) => c.rarity === r).length
            if (count === 0) return null
            return (
              <FilterPill
                key={r}
                active={rarityFilter === r}
                onClick={() => setRarityFilter(rarityFilter === r ? 'all' : r)}
                bg={t.bg}
                activeBg={t.text}
                text={t.text}
                activeText="var(--text-inverse)"
                border={t.border}
              >
                {t.label} <span className="opacity-70">({count})</span>
              </FilterPill>
            )
          })}
        </div>
      </div>

      {/* Subject filter pills */}
      {subjects.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
            Subject
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill
              active={subjectFilter === 'all'}
              onClick={() => setSubjectFilter('all')}
              bg="var(--surface-raised)"
              activeBg="var(--text-primary)"
              text="var(--text-secondary)"
              activeText="var(--text-inverse)"
              border="var(--border-default)"
            >
              All
            </FilterPill>
            {subjects.map((s) => (
              <FilterPill
                key={s.id}
                active={subjectFilter === s.id}
                onClick={() => setSubjectFilter(subjectFilter === s.id ? 'all' : s.id)}
                bg={`${s.colour_token}18`}
                activeBg={s.colour_token}
                text={s.colour_token}
                activeText="var(--text-inverse)"
                border={`${s.colour_token}40`}
              >
                {s.name}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{sorted.length}</strong> cards
        </span>
        {sorted.length > 0 && (
          <span>
            · <strong style={{ color: 'var(--correct)' }}>{sorted.filter((c) => ownedSet.has(c.id)).length}</strong> collected
          </span>
        )}
      </div>

      {/* Grid */}
      {cards.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-10 h-10" style={{ color: 'var(--text-muted)' }} aria-hidden />}
          heading="No cards yet"
          body="Complete a quiz to earn your first Discovery Card. Every quiz you pass drops one."
          action={
            <Link
              href="/dashboard"
              className="flex h-12 items-center justify-center px-6 font-bold text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--brand)', borderRadius: 'var(--radius-button)', fontFamily: 'var(--font-display)' }}
            >
              Go to my topics
            </Link>
          }
        />
      ) : sorted.length === 0 ? (
        <div
          className="flex flex-col items-center rounded-2xl px-6 py-10 text-center"
          style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-card)' }}
        >
          <p className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            No cards match this filter
          </p>
          <button
            onClick={() => { setRarityFilter('all'); setSubjectFilter('all') }}
            className="mt-3 text-sm font-bold underline"
            style={{ color: 'var(--brand)' }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((card) => (
            <DiscoveryCard
              key={card.id}
              card={card}
              collected={ownedSet.has(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterPill({
  children,
  active,
  onClick,
  bg,
  activeBg,
  text,
  activeText,
  border,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  bg: string
  activeBg: string
  text: string
  activeText: string
  border: string
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-[36px] rounded-full px-3 py-1 text-xs font-bold transition-all"
      style={{
        background: active ? activeBg : bg,
        color: active ? activeText : text,
        border: `1.5px solid ${active ? activeBg : border}`,
        fontFamily: 'var(--font-display)',
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}
