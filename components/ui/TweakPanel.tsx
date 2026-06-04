'use client'

import { useState } from 'react'
import { Lightbulb, X } from '@/components/ui/icons'

type Subject = 'maths' | 'english' | 'science' | 'history' | 'geography'
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
type Tier = 'sprout' | 'explorer' | 'lightning'

const SUBJECTS: { key: Subject; label: string; token: string }[] = [
  { key: 'maths',     label: 'Maths',     token: 'var(--maths)'     },
  { key: 'english',   label: 'English',   token: 'var(--english)'   },
  { key: 'science',   label: 'Science',   token: 'var(--science)'   },
  { key: 'history',   label: 'History',   token: 'var(--history)'   },
  { key: 'geography', label: 'Geography', token: 'var(--geography)' },
]

const RARITIES: { key: Rarity; label: string; token: string }[] = [
  { key: 'common',    label: 'Common',    token: 'var(--common)'    },
  { key: 'uncommon',  label: 'Uncommon',  token: 'var(--uncommon)'  },
  { key: 'rare',      label: 'Rare',      token: 'var(--rare)'      },
  { key: 'epic',      label: 'Epic',      token: 'var(--epic)'      },
  { key: 'legendary', label: 'Legendary', token: 'var(--legendary)' },
]

const TIERS: { key: Tier; label: string; token: string }[] = [
  { key: 'sprout',    label: 'Sprout',    token: 'var(--sprout)'    },
  { key: 'explorer',  label: 'Explorer',  token: 'var(--explorer)'  },
  { key: 'lightning', label: 'Lightning', token: 'var(--lightning)' },
]

type Props = {
  /** Called when the user selects a subject — parent can apply it to preview content */
  onSubjectChange?: (subject: Subject) => void
  onRarityChange?: (rarity: Rarity) => void
  onTierChange?: (tier: Tier) => void
  defaultSubject?: Subject
  defaultRarity?: Rarity
  defaultTier?: Tier
}

/**
 * Development-only tweak panel for testing subject themes, rarities, and tiers.
 * Mount conditionally: process.env.NODE_ENV === 'development'
 */
export function TweakPanel({
  onSubjectChange,
  onRarityChange,
  onTierChange,
  defaultSubject = 'maths',
  defaultRarity = 'common',
  defaultTier = 'sprout',
}: Props) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState<Subject>(defaultSubject)
  const [rarity, setRarity] = useState<Rarity>(defaultRarity)
  const [tier, setTier] = useState<Tier>(defaultTier)

  function selectSubject(s: Subject) {
    setSubject(s)
    onSubjectChange?.(s)
  }
  function selectRarity(r: Rarity) {
    setRarity(r)
    onRarityChange?.(r)
  }
  function selectTier(t: Tier) {
    setTier(t)
    onTierChange?.(t)
  }

  const activeSubject = SUBJECTS.find((s) => s.key === subject)!
  const activeRarity  = RARITIES.find((r) => r.key === rarity)!
  const activeTier    = TIERS.find((t) => t.key === tier)!

  return (
    <div
      className="fixed bottom-24 right-4 z-50"
      aria-label="Design tweak panel"
    >
      {/* Collapsed trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
          style={{ background: 'var(--guardian)', boxShadow: 'var(--shadow-guardian)' }}
          title="Open Tweak Panel"
          aria-expanded={false}
        >
          <Lightbulb size={20} aria-hidden />
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          className="w-72 overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-modal)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'var(--guardian-dark)', borderRadius: 'var(--radius-modal) var(--radius-modal) 0 0' }}
          >
            <div className="flex items-center gap-2">
              <Lightbulb size={16} style={{ color: 'var(--guardian-bdr)' }} aria-hidden />
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--text-inverse)', fontFamily: 'var(--font-display)' }}
              >
                Tweak Panel
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ color: 'var(--guardian-bdr)' }}
              aria-label="Close tweak panel"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <div className="space-y-4 p-4">
            {/* Subject selector */}
            <Section label="Subject" activeColor={activeSubject.token} activeLabel={activeSubject.label}>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => selectSubject(s.key)}
                    className="rounded-lg px-2.5 py-1 text-xs font-bold transition-all"
                    style={{
                      background: subject === s.key ? s.token : 'var(--surface-raised)',
                      color: subject === s.key ? '#fff' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-display)',
                      border: subject === s.key ? `2px solid ${s.token}` : '2px solid transparent',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Rarity selector */}
            <Section label="Rarity" activeColor={activeRarity.token} activeLabel={activeRarity.label}>
              <div className="flex flex-wrap gap-1.5">
                {RARITIES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => selectRarity(r.key)}
                    className="rounded-lg px-2.5 py-1 text-xs font-bold transition-all"
                    style={{
                      background: rarity === r.key ? r.token : 'var(--surface-raised)',
                      color: rarity === r.key ? '#fff' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-display)',
                      border: rarity === r.key ? `2px solid ${r.token}` : '2px solid transparent',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Tier selector */}
            <Section label="Difficulty Tier" activeColor={activeTier.token} activeLabel={activeTier.label}>
              <div className="flex gap-1.5">
                {TIERS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => selectTier(t.key)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-bold transition-all"
                    style={{
                      background: tier === t.key ? t.token : 'var(--surface-raised)',
                      color: tier === t.key ? 'var(--text-heading)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-display)',
                      border: tier === t.key ? `2px solid ${t.token}` : '2px solid transparent',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Token preview */}
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}
            >
              <p className="font-bold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                Active tokens
              </p>
              <p className="mt-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                --{subject} / --{rarity} / --{tier}
              </p>
              <div className="mt-2 flex gap-2">
                {[activeSubject, activeRarity, activeTier].map((item) => (
                  <div
                    key={item.key}
                    className="h-5 w-5 rounded"
                    style={{ background: item.token, border: '1px solid rgba(0,0,0,0.1)' }}
                    title={item.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  label,
  activeLabel,
  activeColor,
  children,
}: {
  label: string
  activeLabel: string
  activeColor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
        >
          {label}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-xs font-bold"
          style={{ background: `${activeColor}20`, color: activeColor, fontFamily: 'var(--font-display)' }}
        >
          {activeLabel}
        </span>
      </div>
      {children}
    </div>
  )
}
