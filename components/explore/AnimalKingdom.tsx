'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NarrationButton, stopNarration } from './NarrationButton'
import { CardReveal } from '@/components/cards/CardReveal'
import type { DroppedCard } from '@/app/api/quiz/submit/route'
import type { AnimalExplorer, AnimalNode } from '@/lib/explore/types'
import { useMediaQuery } from './engine/useMediaQuery'

interface Animal {
  key: string; name: string; group: string; habitat: string; emoji: string; color: string
  kidFact: string; summary: string; source_url: string | null
}
function toAnimal(n: AnimalNode): Animal {
  return { key: n.key, name: n.name, group: n.visual.group, habitat: n.visual.habitat, emoji: n.visual.emoji, color: n.visual.color, kidFact: n.content.kidFact, summary: n.content.summary, source_url: n.content.source_url }
}

const PANEL_BG = 'linear-gradient(180deg, rgba(18,12,8,0.98) 0%, rgba(10,7,5,0.99) 100%)'

function InfoPanel({ a, wide, attribution, muted, onToggleMute, onClose, onAskDecifer, onNarrated }: {
  a: Animal; wide: boolean; attribution: string; muted: boolean
  onToggleMute: () => void; onClose: () => void; onAskDecifer?: (c: string) => void
  onNarrated: () => void
}) {
  const motionProps = wide ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } } : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
  const className = wide ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(384px,92vw)] overflow-y-auto' : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-y-auto'
  const style: React.CSSProperties = wide
    ? { maxHeight: '100dvh', background: PANEL_BG, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'calc(var(--bottom-nav-clearance) + 1.5rem)' }
    : { maxHeight: '62dvh', background: PANEL_BG, border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'calc(var(--bottom-nav-clearance) + 1.5rem)' }
  return (
    <motion.div key={a.key} {...motionProps} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className={className} style={style}>
      <div className="sticky top-0 z-10 px-5 pt-5 pb-3" style={{ background: PANEL_BG }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{a.emoji}</span>
            <div>
              <h2 className="font-heading text-xl font-extrabold text-white leading-tight">{a.name}</h2>
              <p className="text-xs font-semibold" style={{ color: a.color }}>{a.group} · {a.habitat}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NarrationButton text={`${a.kidFact} ${a.summary}`} muted={muted} onToggleMute={onToggleMute} autoPlay onComplete={onNarrated} />
            <button onClick={onClose} className="flex items-center justify-center rounded-full text-white/60" style={{ minWidth: 48, minHeight: 48, background: 'rgba(255,255,255,0.08)' }} aria-label="Close">✕</button>
          </div>
        </div>
      </div>
      <div className="px-5 space-y-4">
        <div className="rounded-2xl p-4" style={{ background: `${a.color}1c`, border: `1px solid ${a.color}3a` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: a.color }}>✨ Did you know?</p>
          <p className="text-sm text-white/90 leading-relaxed">{a.kidFact}</p>
        </div>
        <p className="text-sm text-white/80 leading-relaxed">{a.summary}</p>
        <button onClick={() => onAskDecifer?.(`Tell me an amazing fact about the ${a.name.toLowerCase()}.`)} className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform" style={{ background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)', minHeight: 48 }}>
          <span>💭</span> Ask Decifer about the {a.name.toLowerCase()}
        </button>
        <p className="text-[10px] text-white/30 leading-relaxed">{attribution}</p>
      </div>
    </motion.div>
  )
}

interface Props { explorer: AnimalExplorer; onAskDecifer?: (c: string) => void; onExplore?: (k: string) => void }

export function AnimalKingdom({ explorer, onAskDecifer, onExplore }: Props) {
  const animals = useMemo(() => explorer.nodes.map(toAnimal), [explorer.nodes])
  const cfg = explorer.config
  const wide = useMediaQuery('(min-width: 768px)')
  const [selected, setSelected] = useState<Animal | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [revealCard, setRevealCard] = useState<DroppedCard | null>(null)
  const rewardedRef = useRef<Set<string>>(new Set())
  const selectedKeyRef = useRef<string | null>(null)
  const pendingCardRef = useRef<DroppedCard | null>(null)

  const handleSelect = useCallback((a: Animal) => {
    stopNarration(); setSelected(a); selectedKeyRef.current = a.key; onExplore?.(a.key)
  }, [onExplore])

  // Card drops only when the narration plays through and the child is still on
  // that item — listening, not just tapping.
  const handleNarrated = useCallback(async (key: string) => {
    if (key !== selectedKeyRef.current || rewardedRef.current.has(key)) return
    rewardedRef.current.add(key)
    try {
      const res = await fetch('/api/explore/card-drop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aidType: 'animal-kingdom', topicKey: key }) })
      if (res.ok) { const d = await res.json(); if (d.card) pendingCardRef.current = d.card }
    } catch { /* non-fatal */ }
  }, [])

  const handleClose = useCallback(() => {
    stopNarration(); setSelected(null); selectedKeyRef.current = null
    if (pendingCardRef.current) { const c = pendingCardRef.current; pendingCardRef.current = null; setTimeout(() => setRevealCard(c), 350) }
  }, [])
  const handleAsk = useCallback((ctx: string) => { stopNarration(); setSelected(null); selectedKeyRef.current = null; onAskDecifer?.(ctx) }, [onAskDecifer])
  useEffect(() => () => { stopNarration() }, [])

  const visible = filter ? animals.filter((a) => a.group.toLowerCase() === filter) : animals

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: cfg.background }}>
      <div className="flex-1 overflow-y-auto px-4" style={{ paddingTop: 60 }}>
        <div className="mx-auto grid max-w-2xl gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
          {visible.map((a) => (
            <button key={a.key} onClick={() => handleSelect(a)} className="flex flex-col items-center justify-center rounded-2xl py-4 active:scale-95 transition-transform" style={{ background: `${a.color}18`, border: `1px solid ${a.color}55`, minHeight: 104 }}>
              <span className="text-4xl">{a.emoji}</span>
              <span className="mt-1.5 text-xs font-bold text-white text-center px-1 leading-tight">{a.name}</span>
              <span className="text-[10px]" style={{ color: a.color }}>{a.habitat}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-[11px] text-white/30 py-4">Tap any animal to discover it</p>
      </div>

      <div className="flex-none pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(10,7,5,0.96), transparent)' }}>
        <div className="flex gap-2 px-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {cfg.groups.map((g) => {
            const active = filter === g.key
            return (
              <button key={g.key} onClick={() => setFilter((p) => (p === g.key ? null : g.key))} className="flex-none flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap active:scale-95 transition-transform" style={{ minHeight: 40, background: active ? `${g.color}33` : 'rgba(255,255,255,0.06)', border: active ? `1px solid ${g.color}` : '1px solid rgba(255,255,255,0.1)', color: active ? g.color : 'rgba(255,255,255,0.6)' }}>
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && <InfoPanel a={selected} wide={wide} attribution={cfg.attribution} muted={muted} onToggleMute={() => setMuted((m) => !m)} onClose={handleClose} onAskDecifer={handleAsk} onNarrated={() => handleNarrated(selected.key)} />}
      </AnimatePresence>
      {revealCard && <CardReveal card={revealCard} onDismiss={() => setRevealCard(null)} />}
    </div>
  )
}
