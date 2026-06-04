'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Sparkles, Check } from '@/components/ui/icons'

type Question = { display: string; answer: string }
type Config = { title: string; instructions: string; questions: Question[] }

export function FillBlank({ config, topicId }: { config: Config; topicId: string }) {
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [completed, setCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = config.questions[index]
  const total = config.questions.length

  function advance() {
    const next = index + 1
    if (next >= total) {
      setCompleted(true)
    } else {
      setIndex(next)
      setInput('')
      setFeedback(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function check() {
    if (!input.trim() || feedback !== null) return
    const correct = input.trim() === q.answer
    setFeedback(correct ? 'correct' : 'incorrect')
    setTimeout(advance, correct ? 700 : 1800)
  }

  if (completed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="flex justify-center mb-3"><Sparkles className="w-12 h-12 text-maths" aria-hidden /></div>
        <h2 className="font-heading text-2xl font-bold text-ink">Practice Complete!</h2>
        <p className="mt-2 text-muted">You worked through all {total} questions.</p>
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
        <span>
          {index + 1} of {total}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <motion.div
          className="h-full rounded-full bg-maths"
          animate={{ width: `${(index / total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <p className="text-sm text-muted">{config.instructions}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm"
        >
          <p className="mb-5 text-center font-heading text-3xl font-bold text-ink">{q.display}</p>

          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setFeedback(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              placeholder="?"
              autoFocus
              disabled={feedback !== null}
              aria-label="Your answer"
              className={[
                'min-h-[48px] flex-1 rounded-xl border-2 px-4 py-2 text-center font-heading text-xl font-bold outline-none transition-colors',
                feedback === 'correct'
                  ? 'border-correct bg-correct/10 text-correct'
                  : feedback === 'incorrect'
                  ? 'border-incorrect bg-incorrect/10 text-incorrect'
                  : 'border-black/20 focus:border-maths',
              ].join(' ')}
            />
            <button
              onClick={check}
              disabled={!input.trim() || feedback !== null}
              className="min-h-[48px] min-w-[80px] rounded-xl bg-maths px-4 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Check
            </button>
          </div>

          <AnimatePresence>
            {feedback && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-3 text-center font-bold ${
                  feedback === 'correct' ? 'text-correct' : 'text-incorrect'
                }`}
              >
                {feedback === 'correct'
                  ? <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" aria-hidden /> Correct!</span>
                  : `✗ The answer is ${q.answer} — moving on…`}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
