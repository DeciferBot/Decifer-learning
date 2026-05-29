'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

// Equation balancer simulation for Year 7 Maths (algebra).
// config_json shape: { questions: EquationQuestion[] }
// Each question: { prompt, lhs_label, rhs_label, lhs_value, answer, unit?, options: string[] }
// The child picks from options to make both sides equal.

export type EquationQuestion = {
  prompt: string
  lhs_label: string
  rhs_label: string
  lhs_value: number
  answer: number
  unit?: string
  options: string[]
}

export type EquationBalancerConfig = {
  questions: EquationQuestion[]
}

type Props = {
  config: EquationBalancerConfig
  topicId: string
}

function ScaleSVG({ balanced, tilt }: { balanced: boolean; tilt: 'left' | 'right' | 'none' }) {
  const angle = tilt === 'left' ? -12 : tilt === 'right' ? 12 : 0
  return (
    <svg viewBox="0 0 120 80" className="mx-auto w-40" aria-hidden>
      {/* Pole */}
      <line x1="60" y1="10" x2="60" y2="55" stroke="#2D3748" strokeWidth="3" />
      {/* Beam */}
      <motion.g animate={{ rotate: angle }} style={{ originX: '50%', originY: '55px' }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
        <line x1="10" y1="55" x2="110" y2="55" stroke="#2D3748" strokeWidth="3" />
        {/* Left pan */}
        <line x1="20" y1="55" x2="20" y2="65" stroke="#A0AEC0" strokeWidth="2" />
        <rect x="8" y="65" width="24" height="6" rx="2" fill={balanced ? '#40C057' : '#6C9EFF'} />
        {/* Right pan */}
        <line x1="100" y1="55" x2="100" y2="65" stroke="#A0AEC0" strokeWidth="2" />
        <rect x="88" y="65" width="24" height="6" rx="2" fill={balanced ? '#40C057' : '#FF8FAB'} />
      </motion.g>
    </svg>
  )
}

function QuestionView({
  question,
  onCorrect,
}: {
  question: EquationQuestion
  onCorrect: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const pickedValue = selected !== null ? parseFloat(selected) : null
  const correct = pickedValue === question.answer
  const tilt: 'left' | 'right' | 'none' =
    !submitted || correct ? 'none' : pickedValue !== null && pickedValue > question.answer ? 'right' : 'left'
  const balanced = submitted && correct

  function submit() {
    if (!selected) return
    setSubmitted(true)
    if (correct) setTimeout(onCorrect, 1000)
  }

  return (
    <div className="space-y-4">
      <p className="font-heading text-lg font-bold text-ink">{question.prompt}</p>

      <div className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <ScaleSVG balanced={balanced} tilt={tilt} />

        {/* Two sides of the equation */}
        <div className="mt-2 flex items-center justify-center gap-6 text-center">
          <div>
            <p className="text-xs font-bold uppercase text-muted">Left side</p>
            <p className="font-heading text-2xl font-bold text-ink">
              {question.lhs_value}{question.unit ?? ''}
            </p>
            <p className="text-xs text-muted">{question.lhs_label}</p>
          </div>
          <div className="text-2xl font-bold text-muted">=</div>
          <div>
            <p className="text-xs font-bold uppercase text-muted">Right side</p>
            <p className="font-heading text-2xl font-bold" style={{ color: '#6C9EFF' }}>
              {selected ?? '?'}{selected ? (question.unit ?? '') : ''}
            </p>
            <p className="text-xs text-muted">{question.rhs_label}</p>
          </div>
        </div>

        {/* Option buttons */}
        {!submitted && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {question.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setSelected(opt)}
                className={`min-h-[56px] rounded-xl border-2 px-4 py-3 font-heading font-bold transition-colors ${
                  selected === opt
                    ? 'border-maths bg-maths/10 text-maths'
                    : 'border-black/10 bg-background text-ink hover:border-maths hover:bg-maths/5'
                }`}
              >
                {opt}{question.unit ?? ''}
              </button>
            ))}
          </div>
        )}

        {/* Feedback */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 rounded-xl p-3 text-center ${correct ? 'bg-correct/10' : 'bg-incorrect/10'}`}
            >
              <p className="font-bold" style={{ color: correct ? '#40C057' : '#FF6B6B' }}>
                {correct
                  ? '✓ Balanced! The scale is level.'
                  : `Not quite — ${question.rhs_label} = ${question.answer}${question.unit ?? ''}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted && (
          <button
            onClick={submit}
            disabled={!selected}
            className="mt-4 min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Check Balance
          </button>
        )}

        {submitted && !correct && (
          <button
            onClick={() => { setSelected(null); setSubmitted(false) }}
            className="mt-3 min-h-[48px] w-full rounded-xl border border-black/10 px-6 py-3 font-heading font-bold text-ink transition-colors hover:bg-black/5"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

export function EquationBalancer({ config, topicId }: Props) {
  const [qIndex, setQIndex] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="mb-3 text-5xl">⚖️</div>
        <h2 className="font-heading text-2xl font-bold text-ink">Equations balanced!</h2>
        <p className="mt-2 text-muted">You&apos;ve got the hang of it. Time for the quiz!</p>
        <Link
          href={`/topics/${topicId}/quiz`}
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
        >
          Start Quiz →
        </Link>
      </motion.div>
    )
  }

  const question = config.questions[qIndex]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Question {qIndex + 1} of {config.questions.length}</span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-maths transition-all duration-300"
            style={{ width: `${(qIndex / config.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <QuestionView
        key={qIndex}
        question={question}
        onCorrect={() => {
          if (qIndex + 1 >= config.questions.length) setDone(true)
          else setQIndex((i) => i + 1)
        }}
      />
    </div>
  )
}
