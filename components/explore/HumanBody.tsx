'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import type { DroppedCard } from '@/app/api/quiz/submit/route'
import type { BodyExplorer, BodyNode } from '@/lib/explore/types'
import { useMediaQuery } from './engine/useMediaQuery'
import { useReducedMotion } from './engine/useReducedMotion'

interface Organ {
  key: string
  name: string
  system: string
  x: number
  y: number
  color: string
  kidFact: string
  summary: string
  source_url: string | null
}

function toOrgan(n: BodyNode): Organ {
  return {
    key: n.key, name: n.name, system: n.visual.system, x: n.visual.x, y: n.visual.y,
    color: n.visual.color, kidFact: n.content.kidFact, summary: n.content.summary, source_url: n.content.source_url,
  }
}

const PANEL_BG = 'linear-gradient(180deg, rgba(22,12,18,0.98) 0%, rgba(10,6,10,0.99) 100%)'

// Simple, friendly front-facing silhouette in a 0-100 × 0-150 space so hotspot
// coords (0-100, 0-100) map to left:x% top:y%.
function BodySilhouette() {
  return (
    <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="bodyfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
        </linearGradient>
      </defs>
      <g fill="url(#bodyfill)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6">
        <ellipse cx="50" cy="16" rx="11" ry="13" />
        <rect x="45" y="27" width="10" height="7" rx="3" />
        <path d="M30 36 Q50 31 70 36 L66 86 Q50 90 34 86 Z" />
        <rect x="18" y="35" width="11" height="52" rx="5.5" />
        <rect x="71" y="35" width="11" height="52" rx="5.5" />
        <rect x="34" y="85" width="14" height="60" rx="7" />
        <rect x="52" y="85" width="14" height="60" rx="7" />
      </g>
    </svg>
  )
}

function Hotspot({ organ, dimmed, selected, reducedMotion, onSelect }: {
  organ: Organ; dimmed: boolean; selected: boolean; reducedMotion: boolean; onSelect: (o: Organ) => void
}) {
  return (
    <button
      onClick={() => onSelect(organ)}
      className="absolute flex items-center justify-center rounded-full"
      style={{
        left: `${organ.x}%`, top: `${organ.y}%`, transform: 'translate(-50%, -50%)',
        width: 26, height: 26, opacity: dimmed ? 0.2 : 1, transition: 'opacity 0.2s',
      }}
      aria-label={organ.name}
    >
      {!reducedMotion && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: organ.color }}
          animate={{ scale: selected ? [1, 1.9, 1] : [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: selected ? 1.1 : 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className="relative rounded-full" style={{ width: 14, height: 14, background: organ.color, border: '2px solid rgba(255,255,255,0.85)', boxShadow: `0 0 8px ${organ.color}` }} />
    </button>
  )
}

function InfoPanel({ organ, wide, attribution, muted, onToggleMute, onClose, onAskDecifer }: {
  organ: Organ; wide: boolean; attribution: string; muted: boolean
  onToggleMute: () => void; onClose: () => void; onAskDecifer?: (c: string) => void
}) {
  const motionProps = wide
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  const className = wide
    ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)] overflow-y-auto'
    : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto'
  const style: React.CSSProperties = wide
    ? { maxHeight: '100dvh', background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }
    : { maxHeight: '62dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }

  return (
    <motion.div key={organ.key} {...motionProps} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className={className} style={style}>
      <div className="sticky top-0 z-10 px-5 pt-5 pb-3" style={{ background: PANEL_BG }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex-none" style={{ background: organ.color }} />
            <div>
              <h2 className="font-heading text-xl font-extrabold text-white leading-tight">{organ.name}</h2>
              <p className="text-xs font-semibold" style={{ color: organ.color }}>{organ.system} system</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NarrationButton text={`${organ.kidFact} ${organ.summary}`} muted={muted} onToggleMute={onToggleMute} autoPlay />
            <button onClick={onClose} className="flex items-center justify-center rounded-full text-white/60" style={{ minWidth: 48, minHeight: 48, background: 'rgba(255,255,255,0.08)' }} aria-label="Close">✕</button>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        <div className="rounded-2xl p-4" style={{ background: `${organ.color}1c`, border: `1px solid ${organ.color}3a` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: organ.color }}>✨ What it does</p>
          <p className="text-sm text-white/90 leading-relaxed">{organ.kidFact}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">Go deeper</p>
          <p className="text-sm text-white/80 leading-relaxed">{organ.summary}</p>
        </div>

        <button
          onClick={() => onAskDecifer?.(`Tell me a fascinating fact about the ${organ.name.toLowerCase()} in the human body.`)}
          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: 48 }}
        >
          <span>💭</span> Ask Decifer about the {organ.name.toLowerCase()}
        </button>

        <p className="text-[10px] text-white/30 leading-relaxed">
          {attribution}{organ.source_url ? ' Source: Wikipedia.' : ''}
        </p>
      </div>
    </motion.div>
  )
}

interface HumanBodyProps {
  explorer: BodyExplorer
  onAskDecifer?: (context: string) => void
  onExplore?: (key: string) => void
}

export function HumanBody({ explorer, onAskDecifer, onExplore }: HumanBodyProps) {
  const organs = useMemo(() => explorer.nodes.map(toOrgan), [explorer.nodes])
  const cfg = explorer.config
  const wide = useMediaQuery('(min-width: 768px)')
  const reducedMotion = useReducedMotion()

  const [selected, setSelected] = useState<Organ | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const visitedRef = useRef<Set<string>>(new Set())
  const pendingCardRef = useRef<DroppedCard | null>(null)

  const handleSelect = useCallback(async (o: Organ) => {
    stopNarration()
    setSelected(o)
    onExplore?.(o.key)
    if (!visitedRef.current.has(o.key)) {
      visitedRef.current.add(o.key)
      try {
        const res = await fetch('/api/explore/card-drop', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aidType: 'human-body', topicKey: o.key }),
        })
        if (res.ok) { const d = await res.json(); if (d.card) pendingCardRef.current = d.card }
      } catch { /* non-fatal */ }
    }
  }, [onExplore])

  const handleClose = useCallback(() => {
    stopNarration(); setSelected(null)
    if (pendingCardRef.current) {
      const card = pendingCardRef.current
      pendingCardRef.current = null
      setTimeout(() => setRevealCard(card), 350)
    }
  }, [])

  const handleAsk = useCallback((ctx: string) => { stopNarration(); setSelected(null); onAskDecifer?.(ctx) }, [onAskDecifer])

  useEffect(() => () => { stopNarration() }, [])

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: cfg.background }}>
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4" style={{ paddingTop: 56 }}>
        <div className="relative w-full" style={{ maxWidth: 300, aspectRatio: '100 / 150' }}>
          <BodySilhouette />
          {organs.map((o) => (
            <Hotspot
              key={o.key}
              organ={o}
              selected={selected?.key === o.key}
              dimmed={!!filter && o.system.toLowerCase() !== filter}
              reducedMotion={reducedMotion}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      <p className="flex-none text-center text-[11px] text-white/30 pb-1">Tap a glowing spot to explore an organ</p>

      {/* System legend / filter */}
      <div className="flex-none pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(10,6,10,0.96), transparent)' }}>
        <div className="flex gap-2 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {cfg.systems.map((s) => {
            const active = filter === s.key
            return (
              <button
                key={s.key}
                onClick={() => setFilter((p) => (p === s.key ? null : s.key))}
                className="flex-none flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap active:scale-95 transition-transform"
                style={{
                  minHeight: 40,
                  background: active ? `${s.color}33` : 'rgba(255,255,255,0.06)',
                  border: active ? `1px solid ${s.color}` : '1px solid rgba(255,255,255,0.1)',
                  color: active ? s.color : 'rgba(255,255,255,0.6)',
                }}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <InfoPanel
            organ={selected} wide={wide} attribution={cfg.attribution}
            muted={muted} onToggleMute={() => setMuted((m) => !m)}
            onClose={handleClose} onAskDecifer={handleAsk}
          />
        )}
      </AnimatePresence>

      {revealCard && <CardReveal card={revealCard} onDismiss={() => setRevealCard(null)} />}
    </div>
  )
}
