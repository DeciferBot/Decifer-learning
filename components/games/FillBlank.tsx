'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import {
  PracticeHeader, PracticeCard, PracticeFeedback, PracticeButton, PracticeDone,
} from '@/components/games/PracticeShell'

type Question = { display: string; answer: string }
type Config = { title: string; instructions: string; questions: Question[] }

export function FillBlank({ config, topicId }: { config: Config; topicId: string }) {
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [completed, setCompleted] = useState(false)
  const [gotRight, setGotRight] = useState(0)
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
    if (correct) setGotRight((n) => n + 1)
    fireFeedback(correct ? 'correct' : 'incorrect')
    // Wrong answers stay on screen well past reading time (3.5s) and never
    // auto-advance: the child taps Next when ready, so they keep agency over
    // a moment that used to be silently taken from them after 1.8s.
    if (correct) setTimeout(advance, 700)
  }

  if (completed) {
    return (
      <PracticeDone
        topicId={topicId}
        title="Practice complete"
        detail={`You worked through all ${total} questions and got ${gotRight} right first time.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      <PracticeHeader title={config.title} current={index + 1} total={total} />
      <p className="text-sm text-ink-2">{config.instructions}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
        >
          <PracticeCard>
            <p className="mb-5 text-center font-heading text-3xl font-extrabold tracking-[-0.02em] text-ink">
              {q.display}
            </p>

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
                  'min-h-[48px] flex-1 rounded-xl border-2 px-4 text-center font-heading text-xl font-bold outline-none transition-colors placeholder:text-black/30',
                  feedback === 'correct'
                    ? 'border-correct bg-correct/10 text-correct-700'
                    : feedback === 'incorrect'
                      ? 'border-incorrect bg-incorrect/10 text-incorrect-700'
                      : 'border-black/15 focus:border-brand focus:ring-2 focus:ring-brand/30',
                ].join(' ')}
              />
              {feedback === 'incorrect' ? (
                <PracticeButton full={false} onClick={advance}>Next</PracticeButton>
              ) : (
                <PracticeButton full={false} onClick={check} disabled={!input.trim() || feedback !== null}>
                  Check
                </PracticeButton>
              )}
            </div>

            {/* aria-live so screen readers announce the result without moving focus */}
            <div aria-live="polite" aria-atomic="true">
              <AnimatePresence>
                {feedback && (
                  <PracticeFeedback correct={feedback === 'correct'}>
                    {feedback === 'correct' ? 'Correct!' : `Not quite. The answer is ${q.answer}.`}
                  </PracticeFeedback>
                )}
              </AnimatePresence>
            </div>
          </PracticeCard>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
