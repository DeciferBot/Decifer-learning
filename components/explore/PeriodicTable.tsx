'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import type { DroppedCard } from '@/app/api/quiz/submit/route'
import type { PeriodicExplorer, ElementNode } from '@/lib/explore/types'
import { useMediaQuery } from './engine/useMediaQuery'

interface Element {
  key: string
  name: string
  symbol: string
  number: number
  xpos: number
  ypos: number
  period: number
  group: number | null
  categoryKey: string
  color: string
  atomic_mass: number
  phase: string
  category: string
  block: string
  appearance: string | null
  summary: string
  facts: string[]
}

function toElement(n: ElementNode): Element {
  return {
    key: n.key, name: n.name, symbol: n.visual.symbol, number: n.visual.number,
    xpos: n.visual.xpos, ypos: n.visual.ypos, period: n.visual.period, group: n.visual.group,
    categoryKey: n.visual.categoryKey, color: n.visual.color,
    atomic_mass: n.stats.atomic_mass, phase: n.stats.phase, category: n.stats.category,
    block: n.stats.block, appearance: n.stats.appearance,
    summary: n.content.summary, facts: n.content.facts,
  }
}

const PANEL_BG = 'linear-gradient(180deg, rgba(10,12,28,0.98) 0%, rgba(5,7,20,0.99) 100%)'

// ─── Element tile ─────────────────────────────────────────────────────────────

function Tile({ el, dimmed, onSelect }: { el: Element; dimmed: boolean; onSelect: (e: Element) => void }) {
  return (
    <button
      onClick={() => onSelect(el)}
      className="relative flex flex-col items-center justify-center rounded-md transition-transform active:scale-95"
      style={{
        gridColumn: el.xpos,
        gridRow: el.ypos,
        width: 54, height: 54,
        background: `${el.color}22`,
        border: `1px solid ${el.color}88`,
        opacity: dimmed ? 0.22 : 1,
      }}
      aria-label={`${el.name}, element ${el.number}`}
    >
      <span className="absolute top-0.5 left-1 text-[8px] font-medium text-white/55">{el.number}</span>
      <span className="text-base font-extrabold leading-none" style={{ color: el.color }}>{el.symbol}</span>
      <span className="mt-0.5 text-[7px] leading-none text-white/55 truncate max-w-[48px]">{el.name}</span>
    </button>
  )
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function InfoPanel({ el, wide, attribution, muted, onToggleMute, onClose, onAskDecifer, onNarrated }: {
  el: Element
  wide: boolean
  attribution: string
  muted: boolean
  onToggleMute: () => void
  onClose: () => void
  onAskDecifer?: (context: string) => void
  onNarrated: () => void
}) {
  const motionProps = wide
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  const className = wide
    ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)] overflow-y-auto'
    : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto'
  const style: React.CSSProperties = wide
    ? { maxHeight: '100dvh', background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }
    : { maxHeight: '64dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }

  return (
    <motion.div key={el.key} {...motionProps} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className={className} style={style}>
      <div className="sticky top-0 z-10 px-5 pt-5 pb-3" style={{ background: PANEL_BG }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center rounded-xl" style={{ width: 56, height: 56, background: `${el.color}22`, border: `1px solid ${el.color}88` }}>
              <span className="text-[9px] text-white/55 -mb-1">{el.number}</span>
              <span className="text-xl font-extrabold" style={{ color: el.color }}>{el.symbol}</span>
            </div>
            <div>
              <h2 className="font-heading text-xl font-extrabold text-white leading-tight">{el.name}</h2>
              <p className="text-xs capitalize" style={{ color: el.color }}>{el.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NarrationButton text={el.summary} muted={muted} onToggleMute={onToggleMute} autoPlay onComplete={onNarrated} />
            <button onClick={onClose} className="flex items-center justify-center rounded-full text-white/60" style={{ minWidth: 48, minHeight: 48, background: 'rgba(255,255,255,0.08)' }} aria-label="Close">✕</button>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        <p className="text-sm leading-relaxed text-white/85">{el.summary}</p>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Atomic mass', value: `${el.atomic_mass}` },
            { label: 'State (room temp)', value: el.phase },
            { label: 'Period · Group', value: `${el.period}${el.group ? ` · ${el.group}` : ''}` },
            { label: 'Block', value: `${el.block}-block` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-white capitalize">{value}</p>
            </div>
          ))}
        </div>

        {el.facts.length > 0 && (
          <div className="rounded-2xl p-4 space-y-1.5" style={{ background: `${el.color}14`, border: `1px solid ${el.color}33` }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: el.color }}>✨ Key facts</p>
            {el.facts.map((f, i) => (
              <p key={i} className="text-xs text-white/80 leading-relaxed">• {f}</p>
            ))}
          </div>
        )}

        <button
          onClick={() => onAskDecifer?.(`Tell me something amazing about the element ${el.name} (${el.symbol}).`)}
          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: 48 }}
        >
          <span>💭</span> Ask Decifer about {el.name}
        </button>

        <p className="text-[10px] text-white/30 leading-relaxed">{attribution}</p>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface PeriodicTableProps {
  explorer: PeriodicExplorer
  onAskDecifer?: (context: string) => void
  onExplore?: (key: string) => void
}

export function PeriodicTable({ explorer, onAskDecifer, onExplore }: PeriodicTableProps) {
  const elements = useMemo(() => explorer.nodes.map(toElement), [explorer.nodes])
  const cfg = explorer.config
  const wide = useMediaQuery('(min-width: 768px)')

  const [selected, setSelected] = useState<Element | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const rewardedRef = useRef<Set<string>>(new Set())
  const selectedKeyRef = useRef<string | null>(null)
  const pendingCardRef = useRef<DroppedCard | null>(null)

  const handleSelect = useCallback((el: Element) => {
    stopNarration()
    setSelected(el)
    selectedKeyRef.current = el.key
    onExplore?.(el.key)
  }, [onExplore])

  // Card drops only when the narration plays through and the child is still on
  // that item — listening, not just tapping.
  const handleNarrated = useCallback(async (key: string) => {
    if (key !== selectedKeyRef.current || rewardedRef.current.has(key)) return
    rewardedRef.current.add(key)
    try {
      const res = await fetch('/api/explore/card-drop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aidType: 'periodic-table', topicKey: key }),
      })
      if (res.ok) { const d = await res.json(); if (d.card) pendingCardRef.current = d.card }
    } catch { /* non-fatal */ }
  }, [])

  const handleClose = useCallback(() => {
    stopNarration()
    setSelected(null)
    selectedKeyRef.current = null
    if (pendingCardRef.current) {
      const card = pendingCardRef.current
      pendingCardRef.current = null
      setTimeout(() => setRevealCard(card), 350)
    }
  }, [])

  const handleAsk = useCallback((ctx: string) => {
    stopNarration(); setSelected(null); selectedKeyRef.current = null; onAskDecifer?.(ctx)
  }, [onAskDecifer])

  useEffect(() => () => { stopNarration() }, [])

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: cfg.background }}>
      {/* Scrollable table area */}
      <div className="flex-1 overflow-auto px-4" style={{ paddingTop: 64, WebkitOverflowScrolling: 'touch' }}>
        <div
          className="mx-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(18, 54px)',
            gridAutoRows: '54px',
            gap: 4,
            width: 'max-content',
            paddingBottom: 16,
          }}
        >
          {elements.map((el) => (
            <Tile key={el.key} el={el} dimmed={!!filter && el.categoryKey !== filter} onSelect={handleSelect} />
          ))}
          {/* f-block label spanning the gap row */}
          <div style={{ gridColumn: '3 / 13', gridRow: 8 }} className="flex items-center justify-center">
            <span className="text-[10px] text-white/25">Lanthanides &amp; Actinides ↓</span>
          </div>
        </div>
        <p className="text-center text-[11px] text-white/30 pb-3">Scroll to see the whole table · tap any element</p>
      </div>

      {/* Category legend / filter */}
      <div className="flex-none pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(5,7,20,0.96), transparent)' }}>
        <div className="flex gap-2 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {cfg.categories.map((c) => {
            const active = filter === c.key
            return (
              <button
                key={c.key}
                onClick={() => setFilter((p) => (p === c.key ? null : c.key))}
                className="flex-none flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap active:scale-95 transition-transform"
                style={{
                  minHeight: 40,
                  background: active ? `${c.color}33` : 'rgba(255,255,255,0.06)',
                  border: active ? `1px solid ${c.color}` : '1px solid rgba(255,255,255,0.1)',
                  color: active ? c.color : 'rgba(255,255,255,0.6)',
                }}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <InfoPanel
            el={selected}
            wide={wide}
            attribution={cfg.attribution}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onClose={handleClose}
            onAskDecifer={handleAsk}
            onNarrated={() => handleNarrated(selected.key)}
          />
        )}
      </AnimatePresence>

      {revealCard && <CardReveal card={revealCard} onDismiss={() => setRevealCard(null)} />}
    </div>
  )
}
