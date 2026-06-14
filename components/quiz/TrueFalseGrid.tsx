'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from '@/components/ui/icons'

export type TrueFalseStatement = {
  statement: string
  correct: boolean
}

type RowState = boolean | null  // null = unanswered

type Props = {
  statements: TrueFalseStatement[]
  onAnswer: (result: { allCorrect: boolean; correctCount: number; totalCount: number }) => void
  disabled: boolean
}

export function TrueFalseGrid({ statements, onAnswer, disabled }: Props) {
  const [answers, setAnswers] = useState<RowState[]>(() => statements.map(() => null))
  const [submitted, setSubmitted] = useState(false)

  const allAnswered = answers.every((a) => a !== null)

  function toggle(index: number, value: boolean) {
    if (submitted || disabled) return
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)))
  }

  function submit() {
    if (!allAnswered || submitted) return
    const results = statements.map((s, i) => answers[i] === s.correct)
    const correctCount = results.filter(Boolean).length
    setSubmitted(true)
    onAnswer({ allCorrect: correctCount === statements.length, correctCount, totalCount: statements.length })
  }

  return (
    <div className="space-y-3">
      {/* Column headers */}
      <div className="flex items-center">
        <div className="flex-1" />
        <div className="flex gap-2 shrink-0">
          <span className="w-14 text-center text-xs font-bold uppercase tracking-wide text-muted">True</span>
          <span className="w-14 text-center text-xs font-bold uppercase tracking-wide text-muted">False</span>
        </div>
      </div>

      {statements.map((s, i) => {
        const answer = answers[i]
        const isCorrect = submitted ? answer === s.correct : null

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
              submitted
                ? isCorrect
                  ? 'border-correct/40 bg-correct/8'
                  : 'border-incorrect/40 bg-incorrect/8'
                : 'border-black/8 bg-background'
            }`}
          >
            <p className="flex-1 text-sm leading-snug text-ink">{s.statement}</p>

            <div className="flex gap-2 shrink-0">
              {/* True button */}
              <button
                onClick={() => toggle(i, true)}
                disabled={submitted || disabled}
                aria-label={`Mark statement ${i + 1} as True`}
                aria-pressed={answer === true}
                className={`min-h-[48px] w-14 rounded-lg border-2 text-sm font-bold transition-colors
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
                  ${answer === true
                    ? submitted
                      ? s.correct
                        ? 'border-correct bg-correct/20 text-correct-700'
                        : 'border-incorrect bg-incorrect/20 text-rose-700'
                      : 'border-maths bg-maths/20 text-ink'
                    : 'border-black/10 bg-surface text-muted hover:border-maths hover:text-ink'
                  }
                  disabled:cursor-default`}
              >
                T
              </button>

              {/* False button */}
              <button
                onClick={() => toggle(i, false)}
                disabled={submitted || disabled}
                aria-label={`Mark statement ${i + 1} as False`}
                aria-pressed={answer === false}
                className={`min-h-[48px] w-14 rounded-lg border-2 text-sm font-bold transition-colors
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
                  ${answer === false
                    ? submitted
                      ? !s.correct
                        ? 'border-correct bg-correct/20 text-correct-700'
                        : 'border-incorrect bg-incorrect/20 text-rose-700'
                      : 'border-maths bg-maths/20 text-ink'
                    : 'border-black/10 bg-surface text-muted hover:border-maths hover:text-ink'
                  }
                  disabled:cursor-default`}
              >
                F
              </button>
            </div>

            {/* Result indicator — symbol is aria-hidden; sr-only text carries the meaning */}
            <AnimatePresence>
              {submitted && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`shrink-0 text-lg ${isCorrect ? 'text-correct' : 'text-incorrect'}`}
                >
                  <span aria-hidden>{isCorrect ? '✓' : '✗'}</span>
                  <span className="sr-only">{isCorrect ? 'Correct' : 'Incorrect'}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      {/* Correct answer reveal (after submit, for wrong ones) */}
      <AnimatePresence>
        {submitted && statements.some((s, i) => answers[i] !== s.correct) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-correct/10 px-4 py-3 text-sm text-ink"
          >
            <span className="font-bold text-correct-700">Correct answers: </span>
            {statements.map((s, i) => (
              <span key={s.statement} className="mr-2">
                Row {i + 1}: <strong>{s.correct ? 'True' : 'False'}</strong>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!submitted && (
        <button
          onClick={submit}
          disabled={!allAnswered || disabled}
          className="min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" aria-hidden />
          Check Answers
        </button>
      )}
    </div>
  )
}
