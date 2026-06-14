'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Sparkles } from '@/components/ui/icons'

export type DragDropConfig = {
  title: string
  instructions: string
  pairs: { term: string; definition: string }[]
}

type SlotState = 'empty' | 'correct' | 'incorrect'

export function DragDrop({ config, topicId }: { config: DragDropConfig; topicId: string }) {
  const pairs = config.pairs.slice(0, 6)

  // Shuffle definitions on mount
  const [definitions] = useState(() => shuffle(pairs.map((p) => p.definition)))
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(pairs.length).fill(null))
  const [slotState, setSlotState] = useState<SlotState[]>(() => Array(pairs.length).fill('empty'))
  // dragging: tracks the definition being dragged (HTML5 drag API)
  const [dragging, setDragging] = useState<string | null>(null)
  // selected: the definition the child has tapped/clicked to "hold" (pointer/keyboard alternative)
  const [selected, setSelected] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [score, setScore] = useState(0)

  const placed = new Set(slots.filter(Boolean) as string[])
  const unplaced = definitions.filter((d) => !placed.has(d))

  // Place a definition (from drag, click-select, or keyboard) into a slot
  function placeInSlot(def: string, slotIndex: number) {
    const newSlots = slots.map((s) => (s === def ? null : s))
    const newState: SlotState[] = [...slotState]
    newSlots.forEach((s, i) => { if (s === null) newState[i] = 'empty' })
    newSlots[slotIndex] = def
    newState[slotIndex] = 'empty'
    setSlots(newSlots)
    setSlotState(newState)
    setDragging(null)
    setSelected(null)
  }

  function removeFromSlot(slotIndex: number) {
    const newSlots = [...slots]; newSlots[slotIndex] = null
    const newState = [...slotState]; newState[slotIndex] = 'empty'
    setSlots(newSlots); setSlotState(newState)
  }

  // Handle a click/tap on a definition card from the bank
  function handleDefClick(def: string) {
    if (selected === def) {
      // Deselect
      setSelected(null)
    } else {
      setSelected(def)
    }
  }

  // Handle a click/tap on a slot
  function handleSlotClick(slotIndex: number) {
    if (selected) {
      // Place selected definition into this slot
      placeInSlot(selected, slotIndex)
    } else if (slots[slotIndex]) {
      // Return occupant to the bank
      removeFromSlot(slotIndex)
    }
  }

  function checkAnswers() {
    const newState: SlotState[] = slots.map((slot, i) =>
      slot === null ? 'empty' : slot === pairs[i].definition ? 'correct' : 'incorrect'
    )
    const correct = newState.filter((s) => s === 'correct').length
    setSlotState(newState)
    setScore(correct)
    if (correct === pairs.length) {
      setTimeout(() => setCompleted(true), 800)
    } else {
      // Clear incorrect slots after a moment
      setTimeout(() => {
        setSlots((prev) => prev.map((s, i) => (newState[i] === 'incorrect' ? null : s)))
        setSlotState((prev) => prev.map((s) => (s === 'incorrect' ? 'empty' : s)))
      }, 1200)
    }
  }

  const allFilled = slots.every(Boolean)

  if (completed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="flex justify-center mb-3"><Sparkles className="w-12 h-12 text-maths" aria-hidden /></div>
        <h2 className="font-heading text-2xl font-bold text-ink">Perfect Match!</h2>
        <p className="mt-2 text-muted">You matched all {pairs.length} pairs correctly.</p>
        <Link
          href={`/topics/${topicId}/quiz`}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Start the Quiz →
        </Link>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{config.title}</span>
        <span aria-live="polite" aria-atomic="true">{placed.size} / {pairs.length} placed</span>
      </div>
      <p className="text-sm text-muted" id="dragdrop-instructions">
        {config.instructions}
        {/* Keyboard/pointer-alternative hint is always shown — no pointer-required language */}
        {' '}Tap a definition to select it, then tap a slot to place it.
      </p>

      {/* Status for screen readers when something is selected */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {selected ? `"${selected}" selected. Tap a slot to place it.` : ''}
      </div>

      {/* Unplaced definitions bank */}
      <div
        className="flex min-h-[56px] flex-wrap gap-2 rounded-xl border border-dashed border-black/15 p-3"
        aria-label="Available definitions"
      >
        <AnimatePresence>
          {unplaced.map((def) => (
            <motion.button
              key={def}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              // HTML5 drag API
              draggable
              onDragStart={() => { setDragging(def); setSelected(null) }}
              onDragEnd={() => setDragging(null)}
              // Tap-to-select (pointer/keyboard alternative — WCAG 2.5.7)
              onClick={() => handleDefClick(def)}
              aria-pressed={selected === def}
              aria-label={selected === def ? `${def} — selected, tap a slot to place` : def}
              className={[
                'rounded-xl border-2 px-3 py-2 text-sm font-medium select-none transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                selected === def
                  ? 'border-maths bg-maths/15 text-maths ring-2 ring-maths ring-offset-1'
                  : dragging === def
                  ? 'border-maths bg-maths/10 text-maths opacity-50 cursor-grabbing'
                  : 'border-black/15 bg-surface text-ink cursor-grab active:cursor-grabbing hover:border-maths',
              ].join(' ')}
              style={{ minHeight: 48 }}
            >
              {def}
            </motion.button>
          ))}
        </AnimatePresence>
        {unplaced.length === 0 && <p className="text-xs text-muted">All cards placed</p>}
      </div>

      {/* Term → slot grid */}
      <div className="space-y-2" role="list" aria-label="Match each term to its definition">
        {pairs.map((pair, i) => (
          <div key={pair.term} className="flex items-center gap-3" role="listitem">
            {/* Term label */}
            <div
              className="w-[42%] shrink-0 rounded-xl border border-black/10 bg-background px-3 py-2 text-sm font-bold text-ink"
              style={{ minHeight: 48 }}
              aria-label={`Term: ${pair.term}`}
            >
              {pair.term}
            </div>
            {/* Drop slot — also acts as tap-to-place target */}
            <button
              className={[
                'flex min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 px-3 py-2 text-sm transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                slotState[i] === 'correct'
                  ? 'border-correct bg-correct/10 text-correct font-bold'
                  : slotState[i] === 'incorrect'
                  ? 'border-incorrect bg-incorrect/10 text-incorrect font-bold'
                  : selected
                  ? 'border-maths bg-maths/5 border-dashed cursor-pointer'
                  : dragging
                  ? 'border-maths bg-maths/5 border-dashed'
                  : 'border-dashed border-black/20 bg-white/50 text-muted',
              ].join(' ')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragging) placeInSlot(dragging, i) }}
              onClick={() => handleSlotClick(i)}
              aria-label={
                slots[i]
                  ? `${pair.term} matched with "${slots[i]}" — ${slotState[i] === 'correct' ? 'correct' : slotState[i] === 'incorrect' ? 'incorrect' : 'tap to remove'}`
                  : selected
                  ? `Place "${selected}" here for ${pair.term}`
                  : `Empty slot for ${pair.term}`
              }
            >
              {slots[i] ? (
                <span className="flex w-full items-center justify-between gap-2">
                  <span>{slots[i]}</span>
                  {/* Screen reader text for the remove action */}
                  <span className="text-muted text-xs" aria-hidden>✕</span>
                </span>
              ) : (
                <span className="text-xs" aria-hidden>
                  {selected ? 'Place here' : 'Drop here'}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {score > 0 && score < pairs.length && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm text-muted"
            aria-live="polite"
          >
            {score} correct — fix the highlighted ones and try again!
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={checkAnswers}
        disabled={!allFilled}
        className="min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Check Answers
      </button>
    </div>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
