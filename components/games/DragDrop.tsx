'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

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
  const [dragging, setDragging] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [score, setScore] = useState(0)
  // Touch support
  const touchItem = useRef<string | null>(null)

  const placed = new Set(slots.filter(Boolean) as string[])
  const unplaced = definitions.filter((d) => !placed.has(d))

  function onDragStart(def: string) {
    setDragging(def)
  }

  function onDrop(slotIndex: number) {
    if (!dragging) return
    // Remove dragging def from any other slot
    const newSlots = slots.map((s) => (s === dragging ? null : s))
    const newState: SlotState[] = [...slotState]
    newSlots.forEach((s, i) => { if (s === null) newState[i] = 'empty' })
    newSlots[slotIndex] = dragging
    newState[slotIndex] = 'empty'
    setSlots(newSlots)
    setSlotState(newState)
    setDragging(null)
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
        <div className="mb-3 text-5xl">🎉</div>
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
        <span>{placed.size} / {pairs.length} placed</span>
      </div>
      <p className="text-sm text-muted">{config.instructions}</p>

      {/* Unplaced definitions bank */}
      <div className="flex min-h-[56px] flex-wrap gap-2 rounded-xl border border-dashed border-black/15 p-3">
        <AnimatePresence>
          {unplaced.map((def) => (
            <motion.div
              key={def}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              draggable
              onDragStart={() => onDragStart(def)}
              onDragEnd={() => setDragging(null)}
              // Touch
              onTouchStart={() => { touchItem.current = def }}
              className={[
                'cursor-grab rounded-xl border-2 px-3 py-2 text-sm font-medium select-none active:cursor-grabbing',
                dragging === def
                  ? 'border-maths bg-maths/10 text-maths opacity-50'
                  : 'border-black/15 bg-surface text-ink',
              ].join(' ')}
              style={{ minHeight: 48 }}
            >
              {def}
            </motion.div>
          ))}
        </AnimatePresence>
        {unplaced.length === 0 && <p className="text-xs text-muted">All cards placed</p>}
      </div>

      {/* Term → slot grid */}
      <div className="space-y-2">
        {pairs.map((pair, i) => (
          <div key={pair.term} className="flex items-center gap-3">
            {/* Term label */}
            <div className="w-[42%] shrink-0 rounded-xl border border-black/10 bg-background px-3 py-2 text-sm font-bold text-ink" style={{ minHeight: 48 }}>
              {pair.term}
            </div>
            {/* Drop slot */}
            <div
              className={[
                'flex min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 px-3 py-2 text-sm transition-colors',
                slotState[i] === 'correct'
                  ? 'border-correct bg-correct/10 text-correct font-bold'
                  : slotState[i] === 'incorrect'
                  ? 'border-incorrect bg-incorrect/10 text-incorrect font-bold'
                  : dragging
                  ? 'border-maths bg-maths/5 border-dashed'
                  : 'border-dashed border-black/20 bg-white/50 text-muted',
              ].join(' ')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              // Tap-to-place on touch
              onTouchEnd={() => {
                if (touchItem.current) {
                  const def = touchItem.current
                  touchItem.current = null
                  setDragging(def)
                  setTimeout(() => { onDrop(i); setDragging(null) }, 0)
                }
              }}
            >
              {slots[i] ? (
                <div
                  className="flex w-full cursor-pointer items-center justify-between"
                  onClick={() => {
                    const newSlots = [...slots]; newSlots[i] = null
                    const newState = [...slotState]; newState[i] = 'empty'
                    setSlots(newSlots); setSlotState(newState)
                  }}
                >
                  <span>{slots[i]}</span>
                  <span className="text-muted text-xs ml-2">✕</span>
                </div>
              ) : (
                <span className="text-xs">Drop here</span>
              )}
            </div>
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
          >
            {score} correct — fix the highlighted ones and try again!
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={checkAnswers}
        disabled={!allFilled}
        className="min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
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
