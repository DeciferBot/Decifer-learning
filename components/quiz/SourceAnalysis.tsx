'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type SourceAnalysisSubQ = {
  prompt: string
  options: string[]
  correct: number
}

type Props = {
  sourceText: string
  sourceLabel: string
  sourceType: string
  subQuestions: SourceAnalysisSubQ[]
  onAnswer: (result: { allCorrect: boolean; correctCount: number; totalCount: number }) => void
  disabled: boolean
}

type SubState = 'unanswered' | 'correct' | 'wrong'

export default function SourceAnalysis({
  sourceText,
  sourceLabel,
  sourceType,
  subQuestions,
  onAnswer,
  disabled,
}: Props) {
  const [sourceExpanded, setSourceExpanded] = useState(true)
  const [current, setCurrent] = useState(0)
  const [selections, setSelections] = useState<number[]>(Array(subQuestions.length).fill(-1))
  const [states, setStates] = useState<SubState[]>(Array(subQuestions.length).fill('unanswered'))
  const [done, setDone] = useState(false)

  const q = subQuestions[current]

  function handleOption(optIdx: number) {
    if (disabled || states[current] !== 'unanswered') return
    const correct = optIdx === q.correct
    const newStates = [...states]
    newStates[current] = correct ? 'correct' : 'wrong'
    const newSelections = [...selections]
    newSelections[current] = optIdx
    setStates(newStates)
    setSelections(newSelections)

    const isLast = current === subQuestions.length - 1
    if (isLast) {
      const correctCount = newStates.filter((s) => s === 'correct').length
      setDone(true)
      onAnswer({ allCorrect: correctCount === subQuestions.length, correctCount, totalCount: subQuestions.length })
    }
  }

  function nextSub() {
    if (current < subQuestions.length - 1) setCurrent(current + 1)
  }

  const sourceTypeLabel =
    sourceType === 'table'
      ? 'Table'
      : sourceType === 'graph_description'
        ? 'Graph'
        : 'Extract'

  return (
    <div className="space-y-4">
      {/* Source box */}
      <div className="rounded-2xl border-2 border-english/30 bg-english/5 overflow-hidden">
        <button
          onClick={() => setSourceExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          aria-expanded={sourceExpanded}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-english bg-english/20 rounded-full px-2 py-0.5">
              {sourceTypeLabel}
            </span>
            <span className="text-sm font-medium text-ink">{sourceLabel}</span>
          </div>
          <span className="text-muted text-lg" aria-hidden>{sourceExpanded ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence initial={false}>
          {sourceExpanded && (
            <motion.div
              key="source-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">
                <blockquote className="border-l-4 border-english/40 pl-3 text-sm text-ink leading-relaxed italic whitespace-pre-wrap">
                  {sourceText}
                </blockquote>
                <p className="text-xs text-muted mt-2">
                  Use evidence from this source to answer the questions below.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {subQuestions.map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              states[i] === 'correct'
                ? 'bg-correct'
                : states[i] === 'wrong'
                  ? 'bg-incorrect'
                  : i === current
                    ? 'bg-english/50'
                    : 'bg-surface border border-ink/10'
            }`}
          />
        ))}
        <span className="text-xs text-muted whitespace-nowrap">
          Q{current + 1} of {subQuestions.length}
        </span>
      </div>

      {/* Current sub-question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
          className="space-y-3"
        >
          <p className="font-medium text-ink">{q.prompt}</p>

          <div className="grid gap-2">
            {q.options.map((opt, i) => {
              const state = states[current]
              const selected = selections[current] === i
              const isCorrect = i === q.correct
              let cls = 'rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all min-h-[48px] w-full'

              if (state === 'unanswered') {
                cls += ' border-ink/15 bg-surface hover:border-english/60 hover:bg-english/5 active:scale-95'
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

          {/* Feedback + next */}
          {states[current] !== 'unanswered' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <p className={`text-sm font-semibold ${states[current] === 'correct' ? 'text-correct' : 'text-incorrect'}`}>
                {states[current] === 'correct' ? 'Correct — well spotted!' : `The answer was: ${q.options[q.correct]}`}
              </p>
              {current < subQuestions.length - 1 && (
                <button
                  onClick={nextSub}
                  className="rounded-xl bg-english text-white font-bold px-5 py-3 text-sm min-h-[48px] active:scale-95 transition-transform"
                >
                  Next question →
                </button>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Final summary */}
      {done && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-surface border border-ink/10 p-3 text-xs text-muted"
        >
          {states.every((s) => s === 'correct')
            ? '✓ Strong source work — you used the evidence correctly.'
            : 'Tip: always look for specific words in the source that directly answer the question.'}
        </motion.div>
      )}
    </div>
  )
}
