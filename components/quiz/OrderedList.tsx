'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from '@/components/ui/icons'

export type OrderedListItem = {
  item: string
}

type Props = {
  items: OrderedListItem[]      // in correct order — component shuffles for display
  onAnswer: (result: { allCorrect: boolean; correctCount: number; totalCount: number }) => void
  disabled: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function OrderedList({ items, onAnswer, disabled }: Props) {
  // currentOrder holds the item texts in the child's current arrangement
  const [currentOrder, setCurrentOrder] = useState<string[]>(() =>
    shuffle(items.map((i) => i.item))
  )
  const [submitted, setSubmitted] = useState(false)
  const correctOrder = items.map((i) => i.item)

  function moveUp(index: number) {
    if (index === 0 || submitted || disabled) return
    setCurrentOrder((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index: number) {
    if (index === currentOrder.length - 1 || submitted || disabled) return
    setCurrentOrder((prev) => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  function submit() {
    if (submitted || disabled) return
    const totalCount = correctOrder.length
    const correctCount = currentOrder.filter((item, i) => item === correctOrder[i]).length
    const allCorrect = correctCount === totalCount
    setSubmitted(true)
    onAnswer({ allCorrect, correctCount, totalCount })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink-2">
        Use the arrows to put these in the correct order
      </p>

      <div className="space-y-2">
        {currentOrder.map((item, index) => {
          const isCorrect = submitted ? item === correctOrder[index] : null

          return (
            <motion.div
              key={item}
              layout
              transition={{ duration: 0.18 }}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                submitted
                  ? isCorrect
                    ? 'border-correct/40 bg-correct/8'
                    : 'border-incorrect/40 bg-incorrect/8'
                  : 'border-black/8 bg-background'
              }`}
            >
              {/* Position number */}
              <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-sm font-bold text-ink-2">
                {index + 1}
              </span>

              <p className="flex-1 text-sm leading-snug text-ink">{item}</p>

              {/* Up/down controls — 48px targets for developing motor control */}
              {!submitted && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0 || disabled}
                    aria-label={`Move "${item}" up`}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-surface text-ink-2 transition-colors hover:border-maths hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === currentOrder.length - 1 || disabled}
                    aria-label={`Move "${item}" down`}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-surface text-ink-2 transition-colors hover:border-maths hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▼
                  </button>
                </div>
              )}

              {/* Result indicator */}
              <AnimatePresence>
                {submitted && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`shrink-0 text-lg ${isCorrect ? 'text-correct-700' : 'text-rose-700'}`}
                    aria-hidden
                  >
                    {isCorrect ? '✓' : '✗'}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Correct order reveal */}
      <AnimatePresence>
        {submitted && !currentOrder.every((item, i) => item === correctOrder[i]) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-correct/10 px-4 py-3 text-sm text-ink"
          >
            <p className="font-bold text-correct-700 mb-1">Correct order:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              {correctOrder.map((item, i) => (
                <li key={i} className="text-ink">{item}</li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      {!submitted && (
        <button
          onClick={submit}
          disabled={disabled}
          className="min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" aria-hidden />
          Submit Order
        </button>
      )}
    </div>
  )
}
