'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import {
  PracticeHeader, PracticeCard, PracticeFeedback, PracticeButton,
  PracticeSecondaryButton, PracticeDone,
} from '@/components/games/PracticeShell'

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

/**
 * The balance scale. This is the point of the activity: a child should see the
 * beam tip the moment their answer is too big or too small, so "both sides
 * equal" has something physical behind it.
 *
 * Every colour now comes from tokens.css. It used to hard-code #2D3748 and
 * #A0AEC0 for the frame and #40C057 / #6C9EFF / #FF8FAB for the pans, all
 * retired v1 values that exist nowhere else in the product. The old scale was
 * also drawn from bare 3px lines; real pans and a plinth make it read as an
 * object rather than a diagram.
 */
function BalanceScale({ balanced, tilt }: { balanced: boolean; tilt: 'left' | 'right' | 'none' }) {
  const reduceMotion = useReducedMotion()
  const angle = tilt === 'left' ? -11 : tilt === 'right' ? 11 : 0
  const panFill = balanced ? 'rgb(var(--tw-correct))' : 'rgb(var(--tw-ember))'
  return (
    <svg
      viewBox="0 0 140 96"
      className="mx-auto w-48"
      role="img"
      aria-label={balanced ? 'The scale is level' : tilt === 'none' ? 'A balance scale' : 'The scale is tipping'}
    >
      <rect x="52" y="86" width="36" height="6" rx="3" fill="rgb(var(--tw-ink-2))" />
      <rect x="67" y="24" width="6" height="62" rx="3" fill="rgb(var(--tw-ink-2))" />
      <circle cx="70" cy="24" r="5" fill="rgb(var(--tw-ink))" />

      <motion.g
        animate={{ rotate: angle }}
        style={{ originX: '70px', originY: '24px' }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 14 }}
      >
        <rect x="12" y="21" width="116" height="6" rx="3" fill="rgb(var(--tw-ink))" />
        {[24, 116].map((cx) => (
          <g key={cx}>
            <line x1={cx} y1="27" x2={cx} y2="46" stroke="rgb(var(--tw-ink-2))" strokeWidth="2" />
            <path d={`M ${cx - 16} 46 L ${cx + 16} 46 L ${cx + 11} 58 L ${cx - 11} 58 Z`} fill={panFill} />
          </g>
        ))}
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
    fireFeedback(correct ? 'correct' : 'incorrect')
    if (correct) setTimeout(onCorrect, 1000)
  }

  return (
    <div className="space-y-3">
      <p className="text-pretty font-heading text-lg font-bold text-ink">{question.prompt}</p>

      <PracticeCard>
        <BalanceScale balanced={balanced} tilt={tilt} />

        <div className="mt-3 flex items-start justify-center gap-5 text-center">
          <Side label="Left side" value={`${question.lhs_value}${question.unit ?? ''}`} caption={question.lhs_label} />
          <div className="pt-5 font-heading text-2xl font-bold text-ink-2" aria-hidden>=</div>
          <Side
            label="Right side"
            value={selected ? `${selected}${question.unit ?? ''}` : '?'}
            caption={question.rhs_label}
            pending={!selected}
          />
        </div>

        {!submitted && (
          <div className="mt-5 grid grid-cols-2 gap-2.5" role="group" aria-label="Choose a value">
            {question.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setSelected(opt)}
                aria-pressed={selected === opt}
                className={`min-h-[56px] rounded-xl border-2 px-4 font-heading font-bold transition-colors ${
                  selected === opt
                    ? 'border-brand bg-brand/10 text-brand-700'
                    : 'border-black/10 bg-background text-ink hover:border-brand hover:bg-brand/[0.04]'
                }`}
              >
                {opt}{question.unit ?? ''}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {submitted && (
            <PracticeFeedback correct={correct}>
              {correct
                ? 'Balanced. Both sides are equal.'
                : `Not quite. ${question.rhs_label} is ${question.answer}${question.unit ?? ''}.`}
            </PracticeFeedback>
          )}
        </AnimatePresence>

        {!submitted && (
          <div className="mt-4">
            <PracticeButton onClick={submit} disabled={!selected}>Check the balance</PracticeButton>
          </div>
        )}

        {submitted && !correct && (
          <div className="mt-3">
            <PracticeSecondaryButton onClick={() => { setSelected(null); setSubmitted(false) }}>
              Try again
            </PracticeSecondaryButton>
          </div>
        )}
      </PracticeCard>
    </div>
  )
}

function Side({
  label, value, caption, pending,
}: {
  label: string
  value: string
  caption: string
  pending?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`font-heading text-2xl font-extrabold ${pending ? 'text-muted' : 'text-ink'}`}>{value}</p>
      <p className="text-pretty text-xs text-ink-2">{caption}</p>
    </div>
  )
}

export function EquationBalancer({ config, topicId }: Props) {
  const [qIndex, setQIndex] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <PracticeDone
        topicId={topicId}
        title="Equations balanced"
        detail="You have the hang of keeping both sides equal."
      />
    )
  }

  return (
    <div className="space-y-4">
      <PracticeHeader title="Equation balancer" current={qIndex + 1} total={config.questions.length} />
      <QuestionView
        key={qIndex}
        question={config.questions[qIndex]}
        onCorrect={() => {
          if (qIndex + 1 >= config.questions.length) setDone(true)
          else setQIndex((i) => i + 1)
        }}
      />
    </div>
  )
}
