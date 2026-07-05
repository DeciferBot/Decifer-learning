'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type ExplainExamplePart = {
  part: 'example' | 'explain'
  prompt: string
  options: string[]
  correct: number
}

type Props = {
  parts: ExplainExamplePart[]
  onAnswer: (result: { allCorrect: boolean; correctCount: number; totalCount: number }) => void
  disabled: boolean
}

type PartState = 'unanswered' | 'correct' | 'wrong'

const STEP_LABELS: Record<'example' | 'explain', { label: string; colour: string; icon: string }> = {
  example: { label: 'Step 1: Give an example', colour: 'border-maths/40 bg-maths/5', icon: '📌' },
  explain: { label: 'Step 2: Explain why', colour: 'border-science/40 bg-science/5', icon: '💡' },
}

export default function ExplainExample({ parts, onAnswer, disabled }: Props) {
  const [current, setCurrent] = useState(0)
  const [selections, setSelections] = useState<number[]>(Array(parts.length).fill(-1))
  const [states, setStates] = useState<PartState[]>(Array(parts.length).fill('unanswered'))
  const [done, setDone] = useState(false)

  const p = parts[current]
  const meta = STEP_LABELS[p.part] ?? STEP_LABELS.example

  function handleOption(optIdx: number) {
    if (disabled || states[current] !== 'unanswered') return
    const correct = optIdx === p.correct
    const newStates = [...states]
    newStates[current] = correct ? 'correct' : 'wrong'
    const newSelections = [...selections]
    newSelections[current] = optIdx
    setStates(newStates)
    setSelections(newSelections)

    const isLast = current === parts.length - 1
    if (isLast) {
      const correctCount = newStates.filter((s) => s === 'correct').length
      setDone(true)
      onAnswer({ allCorrect: correctCount === parts.length, correctCount, totalCount: parts.length })
    }
  }

  function nextPart() {
    if (current < parts.length - 1) setCurrent(current + 1)
  }

  return (
    <div className="space-y-4">
      {/* Step tracker */}
      <div className="flex gap-2">
        {parts.map((pt, i) => {
          const m = STEP_LABELS[pt.part] ?? STEP_LABELS.example
          const state = states[i]
          return (
            <div
              key={i}
              className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-bold transition-colors ${
                i === current
                  ? m.colour + ' border-opacity-100'
                  : state === 'correct'
                    ? 'border-correct/40 bg-correct/5 text-correct'
                    : state === 'wrong'
                      ? 'border-incorrect/40 bg-incorrect/5 text-incorrect'
                      : 'border-ink/10 bg-surface text-muted'
              }`}
            >
              <span className="mr-1">{m.icon}</span>
              {pt.part === 'example' ? 'Example' : 'Explain'}
              {state === 'correct' && ' ✓'}
              {state === 'wrong' && ' ✗'}
            </div>
          )
        })}
      </div>

      {/* Current part */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
          className="space-y-3"
        >
          <div className={`rounded-xl border-2 p-3 ${meta.colour}`}>
            <p className="text-xs font-bold text-muted uppercase tracking-wide mb-1">{meta.label}</p>
            <p className="font-medium text-ink text-sm">{p.prompt}</p>
          </div>

          <div className="grid gap-2">
            {p.options.map((opt, i) => {
              const state = states[current]
              const selected = selections[current] === i
              const isCorrect = i === p.correct
              let cls = 'rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all min-h-[48px] w-full'

              if (state === 'unanswered') {
                cls += ' border-ink/15 bg-surface hover:border-maths/60 hover:bg-maths/5 active:scale-95'
              } else if (isCorrect) {
                cls += ' border-correct bg-correct/10 text-correct'
              } else if (selected) {
                cls += ' border-incorrect bg-incorrect/10 text-incorrect'
              } else {
                cls += ' border-ink/10 bg-surface/50 text-muted'
              }

              return (
                <button key={i} onClick={() => handleOption(i)} className={cls} disabled={state !== 'unanswered' || disabled}>
                  {opt}
                </button>
              )
            })}
          </div>

          {states[current] !== 'unanswered' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <p className={`text-sm font-semibold ${states[current] === 'correct' ? 'text-correct' : 'text-incorrect'}`}>
                {states[current] === 'correct'
                  ? (p.part === 'example' ? 'Good example! Now explain why.' : 'Excellent explanation!')
                  : `The best answer was: ${p.options[p.correct]}`}
              </p>
              {current < parts.length - 1 && (
                <button
                  onClick={nextPart}
                  className="rounded-xl bg-maths text-white font-bold px-5 py-3 text-sm min-h-[48px] active:scale-95 transition-transform"
                >
                  {p.part === 'example' ? 'Now explain why →' : 'Next →'}
                </button>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {done && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-surface border border-ink/10 p-3 text-sm text-muted"
        >
          {states.every((s) => s === 'correct')
            ? 'Both parts correct. Great exam technique!'
            : `${states.filter((s) => s === 'correct').length} of ${parts.length} parts correct. Remember: a strong answer needs both a specific example AND an explanation.`}
        </motion.div>
      )}
    </div>
  )
}
