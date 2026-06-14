'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import type { DroppedCard } from '@/app/api/quiz/submit/route'
import type { TimelineExplorer, TimelineNode } from '@/lib/explore/types'
import { useMediaQuery } from './engine/useMediaQuery'

interface Event {
  key: string; name: string; era: string; yearLabel: string; color: string; sortYear: number
  kidFact: string; summary: string; source_url: string | null
}
function toEvent(n: TimelineNode): Event {
  return { key: n.key, name: n.name, era: n.visual.era, yearLabel: n.visual.yearLabel, color: n.visual.color, sortYear: n.visual.sortYear, kidFact: n.content.kidFact, summary: n.content.summary, source_url: n.content.source_url }
}

const PANEL_BG = 'linear-gradient(180deg, rgba(16,8,18,0.98) 0%, rgba(9,5,11,0.99) 100%)'

function InfoPanel({ e, wide, attribution, muted, onToggleMute, onClose, onAskDecifer }: {
  e: Event; wide: boolean; attribution: string; muted: boolean
  onToggleMute: () => void; onClose: () => void; onAskDecifer?: (c: string) => void
}) {
  const motionProps = wide ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } } : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  const className = wide ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)] overflow-y-auto' : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto'
  const style: React.CSSProperties = wide
    ? { maxHeight: '100dvh', background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }
    : { maxHeight: '62dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }
  return (
    <motion.div key={e.key} {...motionProps} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className={className} style={style}>
      <div className="sticky top-0 z-10 px-5 pt-5 pb-3" style={{ background: PANEL_BG }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold" style={{ color: e.color }}>{e.yearLabel} · {e.era}</p>
            <h2 className="font-heading text-xl font-extrabold text-white leading-tight">{e.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <NarrationButton text={`${e.kidFact} ${e.summary}`} muted={muted} onToggleMute={onToggleMute} autoPlay />
            <button onClick={onClose} className="flex items-center justify-center rounded-full text-white/60" style={{ minWidth: 48, minHeight: 48, background: 'rgba(255,255,255,0.08)' }} aria-label="Close">✕</button>
          </div>
        </div>
      </div>
      <div className="px-5 space-y-4">
        <div className="rounded-2xl p-4" style={{ background: `${e.color}1c`, border: `1px solid ${e.color}3a` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: e.color }}>✨ In a nutshell</p>
          <p className="text-sm text-white/90 leading-relaxed">{e.kidFact}</p>
        </div>
        <p className="text-sm text-white/80 leading-relaxed">{e.summary}</p>
        <button onClick={() => onAskDecifer?.(`Tell me more about ${e.name} (${e.yearLabel}).`)} className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: 48 }}>
          <span>💭</span> Ask Decifer about this
        </button>
        <p className="text-[10px] text-white/30 leading-relaxed">{attribution}</p>
      </div>
    </motion.div>
  )
}

interface Props { explorer: TimelineExplorer; onAskDecifer?: (c: string) => void; onExplore?: (k: string) => void }

export function HistoryTimeline({ explorer, onAskDecifer, onExplore }: Props) {
  const events = useMemo(() => [...explorer.nodes.map(toEvent)].sort((a, b) => a.sortYear - b.sortYear), [explorer.nodes])
  const cfg = explorer.config
  const wide = useMediaQuery('(min-width: 768px)')
  const [selected, setSelected] = useState<Event | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const visitedRef = useRef<Set<string>>(new Set())
  const pendingCardRef = useRef<DroppedCard | null>(null)

  const handleSelect = useCallback(async (e: Event) => {
    stopNarration(); setSelected(e); onExplore?.(e.key)
    if (!visitedRef.current.has(e.key)) {
      visitedRef.current.add(e.key)
      try {
        const res = await fetch('/api/explore/card-drop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aidType: 'timeline', topicKey: e.key }) })
        if (res.ok) { const d = await res.json(); if (d.card) pendingCardRef.current = d.card }
      } catch { /* non-fatal */ }
    }
  }, [onExplore])

  const handleClose = useCallback(() => {
    stopNarration(); setSelected(null)
    if (pendingCardRef.current) { const c = pendingCardRef.current; pendingCardRef.current = null; setTimeout(() => setRevealCard(c), 350) }
  }, [])
  const handleAsk = useCallback((ctx: string) => { stopNarration(); setSelected(null); onAskDecifer?.(ctx) }, [onAskDecifer])
  useEffect(() => () => { stopNarration() }, [])

  const eraKey = (era: string) => era.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: cfg.background }}>
      <div className="flex-1 overflow-y-auto px-4" style={{ paddingTop: 60 }}>
        <div className="relative mx-auto max-w-xl pl-8">
          {/* vertical rail */}
          <div className="absolute left-3 top-2 bottom-2 w-0.5" style={{ background: 'rgba(255,255,255,0.12)' }} />
          {events.map((e) => {
            const dim = !!filter && eraKey(e.era) !== filter
            return (
              <div key={e.key} className="relative mb-3" style={{ opacity: dim ? 0.25 : 1, transition: 'opacity 0.2s' }}>
                <span className="absolute -left-[22px] top-4 rounded-full" style={{ width: 14, height: 14, background: e.color, border: '2px solid rgba(255,255,255,0.85)', boxShadow: `0 0 8px ${e.color}` }} />
                <button onClick={() => handleSelect(e)} className="block w-full text-left rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform" style={{ background: `${e.color}14`, border: `1px solid ${e.color}3a` }}>
                  <p className="text-[11px] font-bold" style={{ color: e.color }}>{e.yearLabel}</p>
                  <p className="text-sm font-bold text-white leading-tight">{e.name}</p>
                  <p className="text-xs text-white/55 mt-0.5 leading-snug line-clamp-2">{e.kidFact}</p>
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-center text-[11px] text-white/30 py-3">Tap any moment to explore it</p>
      </div>

      <div className="flex-none pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(9,5,11,0.96), transparent)' }}>
        <div className="flex gap-2 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {cfg.eras.map((er) => {
            const active = filter === er.key
            return (
              <button key={er.key} onClick={() => setFilter((p) => (p === er.key ? null : er.key))} className="flex-none flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap active:scale-95 transition-transform" style={{ minHeight: 40, background: active ? `${er.color}33` : 'rgba(255,255,255,0.06)', border: active ? `1px solid ${er.color}` : '1px solid rgba(255,255,255,0.1)', color: active ? er.color : 'rgba(255,255,255,0.6)' }}>
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: er.color }} />
                {er.label}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && <InfoPanel e={selected} wide={wide} attribution={cfg.attribution} muted={muted} onToggleMute={() => setMuted((m) => !m)} onClose={handleClose} onAskDecifer={handleAsk} />}
      </AnimatePresence>
      {revealCard && <CardReveal card={revealCard} onDismiss={() => setRevealCard(null)} />}
    </div>
  )
}
