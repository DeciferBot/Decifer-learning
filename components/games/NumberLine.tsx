'use client'

import { useRef, useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import Link from 'next/link'

// Number line simulation for Year 3 Maths.
// config_json shape: { min: number, max: number, step: number, questions: NumberLineQuestion[] }
// Each question: { prompt: string, target: number, label: string }

export type NumberLineQuestion = {
  prompt: string
  target: number
  label: string
}

export type NumberLineConfig = {
  min: number
  max: number
  step: number
  questions: NumberLineQuestion[]
}

type Props = {
  config: NumberLineConfig
  topicId: string
}

const TRACK_WIDTH = 280
const THUMB_SIZE = 40

function snapToStep(value: number, min: number, step: number): number {
  return Math.round((value - min) / step) * step + min
}

function valueToX(value: number, min: number, max: number): number {
  return ((value - min) / (max - min)) * TRACK_WIDTH
}

function xToValue(x: number, min: number, max: number, step: number): number {
  const raw = (x / TRACK_WIDTH) * (max - min) + min
  return Math.max(min, Math.min(max, snapToStep(raw, min, step)))
}

function QuestionView({
  question,
  config,
  onCorrect,
}: {
  question: NumberLineQuestion
  config: NumberLineConfig
  onCorrect: () => void
}) {
  const { min, max, step } = config
  const [value, setValue] = useState(min)
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  const thumbX = valueToX(value, min, max)
  const targetX = valueToX(question.target, min, max)

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (submitted) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(TRACK_WIDTH, e.clientX - rect.left))
    setValue(xToValue(x, min, max, step))
  }

  function handleDrag(_: unknown, info: { point: { x: number } }) {
    if (submitted) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(TRACK_WIDTH, info.point.x - rect.left))
    setValue(xToValue(x, min, max, step))
  }

  function submit() {
    const isCorrect = value === question.target
    setSubmitted(true)
    setCorrect(isCorrect)
    if (isCorrect) setTimeout(onCorrect, 900)
  }

  const ticks = []
  for (let v = min; v <= max; v += step) {
    const x = valueToX(v, min, max)
    const isMajor = v % (step * 5) === 0 || v === min || v === max
    ticks.push({ v, x, isMajor })
  }

  return (
    <div className="space-y-4">
      <p className="font-heading text-lg font-bold text-ink">{question.prompt}</p>

      <div className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        {/* Number line */}
        <div
          ref={trackRef}
          className="relative mx-auto cursor-pointer select-none"
          style={{ width: TRACK_WIDTH, height: 60 }}
          onClick={handleTrackClick}
        >
          {/* Track */}
          <div
            className="absolute rounded-full bg-black/10"
            style={{ top: 24, left: 0, width: TRACK_WIDTH, height: 4 }}
          />

          {/* Filled portion */}
          <div
            className="absolute rounded-full"
            style={{
              top: 24,
              left: 0,
              width: Math.max(0, thumbX),
              height: 4,
              backgroundColor: '#6C9EFF',
            }}
          />

          {/* Ticks */}
          {ticks.map(({ v, x, isMajor }) => (
            <div key={v} className="absolute" style={{ left: x, top: isMajor ? 16 : 20 }}>
              <div
                className="w-px"
                style={{
                  height: isMajor ? 16 : 8,
                  backgroundColor: isMajor ? '#2D3748' : '#A0AEC0',
                }}
              />
              {isMajor && (
                <p
                  className="mt-1 text-center text-xs"
                  style={{ color: '#718096', transform: 'translateX(-50%)' }}
                >
                  {v}
                </p>
              )}
            </div>
          ))}

          {/* Target indicator (shown after submit) */}
          {submitted && !correct && (
            <div
              className="absolute"
              style={{ left: targetX - 1, top: 10, width: 2, height: 28, backgroundColor: '#40C057' }}
            />
          )}

          {/* Draggable thumb */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: TRACK_WIDTH }}
            dragElastic={0}
            dragControls={dragControls}
            onDrag={handleDrag}
            className="absolute flex cursor-grab items-center justify-center rounded-full border-2 border-white font-heading font-bold text-white shadow-md active:cursor-grabbing"
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              top: 4,
              left: thumbX - THUMB_SIZE / 2,
              backgroundColor: submitted ? (correct ? '#40C057' : '#FF6B6B') : '#6C9EFF',
            }}
          >
            {value}
          </motion.div>
        </div>

        {/* Current value display */}
        <p className="mt-2 text-center text-sm text-muted">
          Selected: <span className="font-bold text-ink">{value}</span>
        </p>

        {/* Feedback */}
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 rounded-xl p-3 text-center ${correct ? 'bg-correct/10' : 'bg-incorrect/10'}`}
          >
            <p className="font-bold" style={{ color: correct ? '#40C057' : '#FF6B6B' }}>
              {correct ? '✓ Correct!' : `Not quite — ${question.label} is ${question.target}`}
            </p>
          </motion.div>
        )}

        {!submitted && (
          <button
            onClick={submit}
            className="mt-4 min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
          >
            Check Answer
          </button>
        )}

        {submitted && !correct && (
          <button
            onClick={() => { setValue(min); setSubmitted(false); setCorrect(false) }}
            className="mt-3 min-h-[48px] w-full rounded-xl border border-black/10 px-6 py-3 font-heading font-bold text-ink transition-colors hover:bg-black/5"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

export function NumberLine({ config, topicId }: Props) {
  const [qIndex, setQIndex] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="mb-3 text-5xl">🎉</div>
        <h2 className="font-heading text-2xl font-bold text-ink">Practice complete!</h2>
        <p className="mt-2 text-muted">You nailed the number line. Ready for the quiz?</p>
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
            style={{ width: `${((qIndex) / config.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <QuestionView
        key={qIndex}
        question={question}
        config={config}
        onCorrect={() => {
          if (qIndex + 1 >= config.questions.length) setDone(true)
          else setQIndex((i) => i + 1)
        }}
      />
    </div>
  )
}
