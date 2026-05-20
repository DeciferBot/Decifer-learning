'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { HintButton } from './HintButton'

export type QuizQuestion = {
  id: string
  tier: string
  question_text: string
  correct_answer: string
  distractors: string[]
  hint_1: string | null
  hint_2: string | null
  hint_3: string | null
  explanation: string | null
}

function shuffleChoices(correct: string, distractors: string[]): string[] {
  const all = [correct, ...distractors]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
}

function buildInitialChoices(q: QuizQuestion): string[] {
  return shuffleChoices(q.correct_answer, q.distractors)
}

export function QuizShell({
  questions,
  topicId,
}: {
  questions: QuizQuestion[]
  topicId: string
}) {
  const [qIndex, setQIndex] = useState(0)
  const [choices, setChoices] = useState<string[]>(() => buildInitialChoices(questions[0]))
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [hintsRevealed, setHintsRevealed] = useState(0)

  const q = questions[qIndex]
  const hints = [q.hint_1, q.hint_2, q.hint_3].filter((h): h is string => h !== null)
  const revealedHints = hints.slice(0, hintsRevealed)

  function pick(choice: string) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    if (choice === q.correct_answer) setScore((s) => s + 1)
  }

  function revealNextHint() {
    if (hintsRevealed < hints.length) setHintsRevealed((n) => n + 1)
  }

  function next() {
    const nextIdx = qIndex + 1
    if (nextIdx >= questions.length) {
      setDone(true)
      return
    }
    const nextQ = questions[nextIdx]
    setChoices(buildInitialChoices(nextQ))
    setQIndex(nextIdx)
    setSelected(null)
    setAnswered(false)
    setHintsRevealed(0)
  }

  function restart() {
    setQIndex(0)
    setChoices(buildInitialChoices(questions[0]))
    setSelected(null)
    setAnswered(false)
    setScore(0)
    setDone(false)
    setHintsRevealed(0)
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    const passed = pct >= 70
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="mb-3 text-5xl">{passed ? '🌟' : '💪'}</div>
        <h2 className="font-heading text-2xl font-bold text-ink">
          {passed ? 'Great work!' : 'Keep going!'}
        </h2>
        <p
          className="mt-2 text-4xl font-bold"
          style={{ color: passed ? '#40C057' : '#FF6B6B' }}
        >
          {score} / {questions.length}
        </p>
        <p className="mt-1 text-muted">
          {pct}% —{' '}
          {passed ? 'Topic complete!' : 'Try again to improve your score.'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {!passed && (
            <button
              onClick={restart}
              className="min-h-[48px] rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
            >
              Try Again
            </button>
          )}
          <Link
            href="/dashboard/child"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-black/10 px-6 py-3 font-heading font-bold text-ink transition-colors hover:bg-black/5"
          >
            Back to Home
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {qIndex + 1} of {questions.length}
        </span>
        <span className="font-bold text-ink">Score: {score}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <motion.div
          className="h-full rounded-full bg-maths"
          animate={{ width: `${(qIndex / questions.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={qIndex}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm"
        >
          <p className="mb-5 font-heading text-xl font-bold leading-snug text-ink">
            {q.question_text}
          </p>

          <HintButton
            hints={hints}
            revealed={revealedHints}
            onReveal={revealNextHint}
            disabled={answered}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            {choices.map((choice) => {
              let cls =
                'min-h-[56px] rounded-xl border-2 px-4 py-3 text-center font-heading font-bold text-ink transition-colors'
              if (!answered) {
                cls += ' border-black/10 bg-background hover:border-maths hover:bg-maths/10'
              } else if (choice === q.correct_answer) {
                cls += ' border-correct bg-correct/20 text-correct'
              } else if (choice === selected) {
                cls += ' border-incorrect bg-incorrect/20 text-incorrect'
              } else {
                cls += ' border-black/10 bg-background opacity-50'
              }
              return (
                <motion.button
                  key={choice}
                  onClick={() => pick(choice)}
                  disabled={answered}
                  whileTap={answered ? {} : { scale: 0.97 }}
                  className={cls}
                >
                  {choice}
                </motion.button>
              )
            })}
          </div>

          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-4 rounded-xl p-4 ${
                  selected === q.correct_answer ? 'bg-correct/10' : 'bg-incorrect/10'
                }`}
              >
                <p
                  className="font-bold"
                  style={{
                    color:
                      selected === q.correct_answer ? '#40C057' : '#FF6B6B',
                  }}
                >
                  {selected === q.correct_answer
                    ? '✓ Correct!'
                    : `✗ The answer is ${q.correct_answer}`}
                </p>
                {q.explanation && (
                  <p className="mt-1 text-sm text-muted">{q.explanation}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {answered && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={next}
              className="mt-4 min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
            >
              {qIndex + 1 < questions.length ? 'Next Question →' : 'See Results'}
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
