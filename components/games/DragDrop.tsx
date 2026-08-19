'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import { PracticeButton, PracticeDone } from '@/components/games/PracticeShell'

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
    fireFeedback(correct === pairs.length ? 'correct' : 'incorrect')
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
      <PracticeDone
        topicId={topicId}
        title="Every pair matched"
        detail={`You matched all ${pairs.length} terms to the right definition.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-ink">{config.title}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-2" aria-live="polite" aria-atomic="true">
          {placed.size} of {pairs.length} placed
        </span>
      </div>
      <p className="text-sm text-ink-2" id="dragdrop-instructions">
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
              aria-label={selected === def ? `${def}, selected, tap a slot to place` : def}
              className={[
                'rounded-xl border-2 px-3 py-2 text-sm font-medium select-none transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                selected === def
                  ? 'border-brand bg-brand/15 text-on-maths ring-2 ring-brand ring-offset-1'
                  : dragging === def
                  ? 'border-brand bg-brand/10 text-on-maths opacity-50 cursor-grabbing'
                  : 'border-black/15 bg-surface text-ink cursor-grab active:cursor-grabbing hover:border-brand',
              ].join(' ')}
              style={{ minHeight: 48 }}
            >
              {def}
            </motion.button>
          ))}
        </AnimatePresence>
        {unplaced.length === 0 && <p className="text-xs text-ink-2">All cards placed</p>}
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
                  ? 'border-correct bg-correct/10 text-correct-700 font-bold'
                  : slotState[i] === 'incorrect'
                  ? 'border-incorrect bg-incorrect/10 text-incorrect-700 font-bold'
                  : selected
                  ? 'border-brand bg-brand/5 border-dashed cursor-pointer'
                  : dragging
                  ? 'border-brand bg-brand/5 border-dashed'
                  : 'border-dashed border-black/20 bg-surface/50 text-muted',
              ].join(' ')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragging) placeInSlot(dragging, i) }}
              onClick={() => handleSlotClick(i)}
              aria-label={
                slots[i]
                  ? `${pair.term} matched with "${slots[i]}", ${slotState[i] === 'correct' ? 'correct' : slotState[i] === 'incorrect' ? 'incorrect' : 'tap to remove'}`
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
            className="text-center text-sm text-ink-2"
            aria-live="polite"
          >
            {score} correct. Fix the highlighted ones and try again!
          </motion.p>
        )}
      </AnimatePresence>

      <PracticeButton onClick={checkAnswers} disabled={!allFilled}>Check answers</PracticeButton>
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
