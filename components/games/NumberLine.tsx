'use client'

import { useEffect, useRef, useState } from 'react'
import { fireFeedback } from '@/lib/feedback'
import { THUMB_RADIUS, safeStep, ticksFor, valueToX } from '@/lib/games/number-line'
import {
  PracticeHeader, PracticeCard, PracticeFeedback, PracticeButton,
  PracticeSecondaryButton, PracticeDone,
} from '@/components/games/PracticeShell'

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

/**
 * The track measures itself instead of assuming 280px.
 *
 * The old version hard-coded TRACK_WIDTH = 280 and positioned the thumb, the
 * ticks and the fill from that constant. On a 320px phone the line ran past
 * the card padding, and on a tablet it stayed a stubby 280px in the middle of
 * a wide screen. Neither the drag maths nor the click maths could ever agree
 * with the rendered element, because only one of them knew the real width.
 */
function useTrackWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
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
  const { min, max } = config
  const step = safeStep(config.step, min, max)
  const [value, setValue] = useState(min)
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const { ref: trackRef, width } = useTrackWidth()

  /**
   * Where a value sits along the track, in pixels.
   *
   * Inset by half the handle at each end, because that is how a native range
   * input maps its value: the thumb centre travels from `thumbRadius` to
   * `width - thumbRadius`, never to the bare edges. Painting across the full
   * width instead put the handle up to 22px away from the finger dragging it,
   * and let it hang off the end of the track at max.
   */
  const toX = (v: number) => valueToX(v, min, max, width)

  const thumbX = toX(value)
  const targetX = toX(question.target)

  function submit() {
    const isCorrect = value === question.target
    setSubmitted(true)
    setCorrect(isCorrect)
    fireFeedback(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) setTimeout(onCorrect, 900)
  }

  const ticks = ticksFor(min, max, config.step)

  return (
    <div className="space-y-3">
      <p className="text-pretty font-heading text-lg font-bold text-ink">{question.prompt}</p>

      <PracticeCard>
        {/*
          A native range input drives the value. It gives keyboard control,
          screen-reader announcements and the platform's own drag handling for
          free — all of which the old bespoke framer-motion thumb had to
          reimplement, and only partly did (it had no keyboard support at all).
          The visible track below is painted over it; the input itself stays
          interactive and transparent on top.
        */}
        {/* Everything inside is positioned from the measured width, so it is
            held back until the first measurement lands. Painting at width 0
            first stacked every tick and the handle at x=0 for a frame. */}
        <div
          className={`relative mx-auto h-16 w-full max-w-[420px] transition-opacity ${width ? 'opacity-100' : 'opacity-0'}`}
          ref={trackRef}
        >
          <div
            className="pointer-events-none absolute top-[26px] h-1.5 rounded-full bg-black/10"
            style={{ left: THUMB_RADIUS, right: THUMB_RADIUS }}
          />
          <div
            className="pointer-events-none absolute top-[26px] h-1.5 rounded-full bg-brand"
            style={{ left: THUMB_RADIUS, width: Math.max(0, thumbX - THUMB_RADIUS) }}
          />

          {ticks.map(({ v, isMajor }) => (
            <div key={v} className="pointer-events-none absolute" style={{ left: toX(v), top: isMajor ? 18 : 22 }}>
              <div
                className={isMajor ? 'w-px bg-ink' : 'w-px bg-black/25'}
                style={{ height: isMajor ? 16 : 8 }}
              />
              {isMajor && (
                <p className="mt-1 text-center text-[11px] tabular-nums text-ink-2" style={{ transform: 'translateX(-50%)' }}>
                  {v}
                </p>
              )}
            </div>
          ))}

          {/* Where the answer actually was, revealed only after a wrong go. */}
          {submitted && !correct && (
            <div
              className="pointer-events-none absolute rounded-full bg-correct-700"
              style={{ left: targetX - 1.5, top: 14, width: 3, height: 26 }}
              aria-hidden
            />
          )}

          {/* The handle. Sits under the transparent range input. */}
          <div
            className={`pointer-events-none absolute flex items-center justify-center rounded-full font-heading text-sm font-bold text-white shadow-md ring-2 ring-white ${
              submitted ? (correct ? 'bg-correct-700' : 'bg-incorrect-700') : 'bg-brand-600'
            }`}
            style={{ width: THUMB_RADIUS * 2, height: THUMB_RADIUS * 2, top: 5, left: thumbX - THUMB_RADIUS }}
            aria-hidden
          >
            {value}
          </div>

          {/* The input alone owns the value. It used to also carry an
              onPointerDown that recomputed the value from clientX, which
              raced the browser's own mapping and made the handle jump. */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={submitted}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label={question.label}
            className="absolute inset-x-0 top-[14px] h-11 w-full cursor-pointer opacity-0 disabled:cursor-default"
          />
        </div>

        <p className="mt-1 text-center text-sm text-ink-2">
          Selected: <span className="font-bold tabular-nums text-ink">{value}</span>
        </p>

        {submitted && (
          <PracticeFeedback correct={correct}>
            {correct ? 'Correct!' : `Not quite. ${question.label} is ${question.target}.`}
          </PracticeFeedback>
        )}

        {!submitted && (
          <div className="mt-4">
            <PracticeButton onClick={submit}>Check answer</PracticeButton>
          </div>
        )}

        {submitted && !correct && (
          <div className="mt-3">
            <PracticeSecondaryButton onClick={() => { setValue(min); setSubmitted(false); setCorrect(false) }}>
              Try again
            </PracticeSecondaryButton>
          </div>
        )}
      </PracticeCard>
    </div>
  )
}

export function NumberLine({ config, topicId }: Props) {
  const [qIndex, setQIndex] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <PracticeDone
        topicId={topicId}
        title="Practice complete"
        detail="You found every number on the line."
      />
    )
  }

  return (
    <div className="space-y-4">
      <PracticeHeader title="Number line" current={qIndex + 1} total={config.questions.length} />
      <QuestionView
        key={qIndex}
        question={config.questions[qIndex]}
        config={config}
        onCorrect={() => {
          if (qIndex + 1 >= config.questions.length) setDone(true)
          else setQIndex((i) => i + 1)
        }}
      />
    </div>
  )
}
