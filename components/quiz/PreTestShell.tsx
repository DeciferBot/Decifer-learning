'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HintButton } from './HintButton'
import type { QuizQuestion } from './QuizShell'
import { Brain, Lightbulb, Check } from '@/components/ui/icons'
import MathText from '@/components/ui/MathText'

type Phase = 'attempt' | 'explanation' | 'done'

type Props = {
  question: QuizQuestion
  topicId: string
  nextHref: string
  nextLabel: string
}

function shuffleChoices(correct: string, distractors: string[]): string[] {
  const all = [correct, ...distractors]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
}

export function PreTestShell({ question, nextHref, nextLabel }: Props) {
  const [phase, setPhase] = useState<Phase>('attempt')
  const [choices] = useState(() => shuffleChoices(question.correct_answer, question.distractors))
  const [selected, setSelected] = useState<string | null>(null)
  const [hintsRevealed, setHintsRevealed] = useState(0)

  const hints = [question.hint_1, question.hint_2, question.hint_3].filter(
    (h): h is string => h !== null,
  )
  const revealedHints = hints.slice(0, hintsRevealed)
  const isCorrect = selected === question.correct_answer

  function pick(choice: string) {
    if (phase !== 'attempt') return
    setSelected(choice)
    setPhase('explanation')
  }

  return (
    <div className="space-y-4">
      {/* Phase badge */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-explorer/20 px-3 py-1 text-xs font-bold text-explorer flex items-center gap-1 w-fit">
          {phase === 'attempt' ? <><Brain className="w-3.5 h-3.5" aria-hidden /> Try it first!</> : <><Lightbulb className="w-3.5 h-3.5" aria-hidden /> Now let&apos;s learn</>}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'attempt' && (
          <motion.div
            key="attempt"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm"
          >
            <p className="mb-2 text-sm font-bold text-muted">
              Have a go, don&apos;t worry if you&apos;re not sure yet!
            </p>
            <p className="mb-5 font-heading text-xl font-bold leading-snug text-ink">
              <MathText text={question.question_text} />
            </p>

            <HintButton
              hints={hints}
              revealed={revealedHints}
              onReveal={() => setHintsRevealed((n) => n + 1)}
              disabled={false}
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              {choices.map((choice) => (
                <motion.button
                  key={choice}
                  onClick={() => pick(choice)}
                  whileTap={{ scale: 0.97 }}
                  className="min-h-[56px] rounded-xl border-2 border-black/10 bg-background px-4 py-3 text-center font-heading font-bold text-ink transition-colors hover:border-explorer hover:bg-explorer/10"
                >
                  <MathText text={choice} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'explanation' && (
          <motion.div
            key="explanation"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Result banner */}
            <div
              className={`rounded-xl p-4 ${
                isCorrect ? 'bg-correct/10' : 'bg-incorrect/10'
              }`}
            >
              <p
                className="font-bold"
                style={{ color: isCorrect ? '#40C057' : '#FF6B6B' }}
              >
                {isCorrect
                  ? <span className="flex items-center gap-1"><Check className="w-4 h-4" aria-hidden /> You got it! Great intuition.</span>
                  : <>Not quite. The answer is <MathText text={question.correct_answer} /></>}
              </p>
              {question.explanation && (
                <p className="mt-2 text-sm text-muted"><MathText text={question.explanation} /></p>
              )}
            </div>

            {/* Call to action — continue to learn content */}
            <div className="rounded-2xl border border-explorer/30 bg-explorer/5 p-5">
              <p className="font-heading font-bold text-ink">
                {isCorrect
                  ? 'You already have good instincts. Now see the full explanation:'
                  : "Now let's understand why. Read on and it'll make sense:"}
              </p>
              <a
                href={nextHref}
                className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-explorer px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                {nextLabel} →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
