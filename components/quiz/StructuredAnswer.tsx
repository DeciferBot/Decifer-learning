'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MarkingResult } from '@/app/api/quiz/mark/route'

export type MarkingCriterion = {
  criterion: string
  marks: number
}

type Phase = 'writing' | 'marking' | 'done' | 'error'

type Props = {
  criteria: MarkingCriterion[]
  questionId: string
  onAnswer: (result: { allCorrect: boolean; correctCount: number; totalCount: number }) => void
  disabled: boolean
}

const MIN_CHARS = 10

export default function StructuredAnswer({ criteria, questionId, onAnswer, disabled }: Props) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('writing')
  const [result, setResult] = useState<MarkingResult | null>(null)
  const [modelRevealed, setModelRevealed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const marksAvailable = criteria.reduce((sum, c) => sum + (c.marks ?? 1), 0)
  const canSubmit = text.trim().length >= MIN_CHARS && phase === 'writing' && !disabled

  async function handleSubmit() {
    if (!canSubmit) return
    setPhase('marking')

    try {
      const res = await fetch('/api/quiz/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, childAnswer: text }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[StructuredAnswer] marking error:', err)
        setPhase('error')
        return
      }

      const data: MarkingResult = await res.json()
      setResult(data)
      setPhase('done')

      // 50% threshold for extended answers — partial credit is meaningful here
      const passed = data.marksAwarded >= Math.ceil(data.marksAvailable / 2)
      onAnswer({
        allCorrect: passed,
        correctCount: data.marksAwarded,
        totalCount: data.marksAvailable,
      })
    } catch (err) {
      console.error('[StructuredAnswer] network error:', err)
      setPhase('error')
    }
  }

  function retry() {
    setPhase('writing')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <div className="space-y-4">
      {/* Marking rubric hint — shown while writing */}
      {phase === 'writing' && (
        <div className="rounded-xl border border-ink/10 bg-surface p-3 space-y-1">
          <p className="text-xs font-bold text-muted uppercase tracking-wide">
            {marksAvailable} mark{marksAvailable !== 1 ? 's' : ''} available — try to cover:
          </p>
          <ul className="space-y-1">
            {criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink">
                <span className="mt-0.5 shrink-0 rounded-full bg-maths/15 text-maths text-xs font-bold w-5 h-5 flex items-center justify-center">
                  {c.marks}
                </span>
                <span>{c.criterion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Text input — hidden once marked */}
      {phase !== 'done' && (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={phase !== 'writing' || disabled}
            placeholder="Write your answer here…"
            rows={5}
            maxLength={2000}
            className="w-full rounded-xl border-2 border-ink/15 bg-surface px-4 py-3 text-sm text-ink
                       placeholder:text-muted resize-none focus:outline-none focus:border-maths/60
                       disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{text.length}/2000</span>
            {text.trim().length > 0 && text.trim().length < MIN_CHARS && (
              <span className="text-xs text-muted">Keep going…</span>
            )}
          </div>
        </div>
      )}

      {/* Submit / marking spinner */}
      <AnimatePresence mode="wait">
        {phase === 'writing' && (
          <motion.button
            key="submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full min-h-[48px] rounded-xl bg-maths text-white font-bold text-sm
                       px-6 py-3 transition-opacity disabled:opacity-40 active:scale-95"
            whileTap={canSubmit ? { scale: 0.97 } : {}}
          >
            Mark my answer ✓
          </motion.button>
        )}

        {phase === 'marking' && (
          <motion.div
            key="marking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 py-4"
          >
            <motion.div
              className="w-5 h-5 rounded-full border-2 border-maths border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
            <span className="text-sm text-muted font-medium">Reading your answer…</span>
          </motion.div>
        )}

        {phase === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 rounded-xl bg-incorrect/10 border border-incorrect/30 p-4"
          >
            <p className="text-sm font-semibold text-incorrect">
              Couldn&apos;t mark this time — please try again.
            </p>
            <button
              onClick={retry}
              className="rounded-xl border-2 border-incorrect/40 px-4 py-2 text-sm font-bold
                         text-incorrect min-h-[48px] active:scale-95 transition-transform"
            >
              Try again
            </button>
          </motion.div>
        )}

        {phase === 'done' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Score badge */}
            <div className={`rounded-xl p-4 flex items-center gap-4 ${
              result.marksAwarded >= Math.ceil(result.marksAvailable / 2)
                ? 'bg-correct/10 border border-correct/30'
                : 'bg-incorrect/10 border border-incorrect/30'
            }`}>
              <div className={`text-3xl font-heading font-black tabular-nums ${
                result.marksAwarded >= Math.ceil(result.marksAvailable / 2)
                  ? 'text-correct'
                  : 'text-incorrect'
              }`}>
                {result.marksAwarded}/{result.marksAvailable}
              </div>
              <div>
                <p className={`text-sm font-bold ${
                  result.marksAwarded >= Math.ceil(result.marksAvailable / 2)
                    ? 'text-correct'
                    : 'text-incorrect'
                }`}>
                  {result.marksAwarded >= Math.ceil(result.marksAvailable / 2)
                    ? 'Good answer!'
                    : 'Keep practising!'}
                </p>
                <p className="text-xs text-muted mt-0.5">{result.feedback}</p>
              </div>
            </div>

            {/* Criteria breakdown */}
            <div className="space-y-1.5">
              {criteria.map((c, i) => {
                const met = result.criteriaMet.includes(i)
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm ${
                      met ? 'bg-correct/10 text-ink' : 'bg-incorrect/10 text-muted'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 font-bold text-xs ${
                      met ? 'text-correct' : 'text-incorrect'
                    }`}>
                      {met ? '✓' : '✗'}
                    </span>
                    <span>{c.criterion}</span>
                    <span className={`ml-auto shrink-0 text-xs font-bold ${
                      met ? 'text-correct' : 'text-muted'
                    }`}>
                      {met ? `+${c.marks}` : `0/${c.marks}`}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Model answer reveal */}
            <div className="rounded-xl border border-ink/10 overflow-hidden">
              <button
                onClick={() => setModelRevealed((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted hover:text-ink transition-colors"
                aria-expanded={modelRevealed}
              >
                <span className="font-semibold">See model answer</span>
                <span aria-hidden>{modelRevealed ? '▲' : '▼'}</span>
              </button>
              <AnimatePresence initial={false}>
                {modelRevealed && (
                  <motion.div
                    key="model"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-ink/10">
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap pt-3">
                        {result.modelAnswer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Child's own answer for comparison */}
            <details className="text-xs text-muted">
              <summary className="cursor-pointer hover:text-ink transition-colors">Your answer</summary>
              <p className="mt-2 pl-2 border-l-2 border-ink/10 leading-relaxed whitespace-pre-wrap">{text}</p>
            </details>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
