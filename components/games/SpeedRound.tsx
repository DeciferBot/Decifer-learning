'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Target, RefreshCw, Clock } from '@/components/ui/icons'
import MathText from '@/components/ui/MathText'
import { fireFeedback } from '@/lib/feedback'
import {
  PracticeHeader, PracticeDone, PracticeSecondaryButton,
} from '@/components/games/PracticeShell'

export type SpeedRoundConfig = {
  title: string
  instructions: string
  timePerQuestion: number // seconds, default 8
  questions: {
    question: string
    correct: string
    distractors: string[]
  }[]
}

type AnswerState = 'unanswered' | 'correct' | 'incorrect' | 'timeout'

export function SpeedRound({ config, topicId }: { config: SpeedRoundConfig; topicId: string }) {
  const questions = config.questions.slice(0, 10)
  const timeLimit = config.timePerQuestion ?? 8

  const [index, setIndex] = useState(0)
  const [options] = useState(() => questions.map((q) => shuffle([q.correct, ...q.distractors.slice(0, 3)])))
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered')
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [results, setResults] = useState<AnswerState[]>([])
  const [done, setDone] = useState(false)
  const [streak, setStreak] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const advance = useCallback(
    (state: AnswerState) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setAnswerState(state)
      fireFeedback(state === 'correct' ? 'correct' : 'incorrect')
      const newResults = [...results, state]
      if (state === 'correct') {
        setStreak((s) => {
          const next = s + 1
          // A streak cue on every 3rd correct in a row — layered on top of the
          // per-answer 'correct' cue already fired in answer()/the timeout path.
          if (next > 0 && next % 3 === 0) fireFeedback('combo')
          return next
        })
      } else {
        setStreak(0)
      }
      setTimeout(() => {
        if (index + 1 >= questions.length) {
          setResults(newResults)
          setDone(true)
          fireFeedback('roundComplete')
        } else {
          setResults(newResults)
          setIndex((i) => i + 1)
          setAnswerState('unanswered')
          setTimeLeft(timeLimit)
        }
      }, state === 'correct' ? 600 : 1200)
    },
    [index, questions.length, results, timeLimit],
  )

  // Timer — ticks audibly/haptically for the last 3 seconds so the countdown
  // is felt, not just read off a shrinking bar.
  useEffect(() => {
    if (answerState !== 'unanswered' || done) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          advance('timeout')
          return 0
        }
        if (t <= 4) fireFeedback('tick')
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [index, answerState, done, advance])

  function answer(choice: string) {
    if (answerState !== 'unanswered') return
    const correct = choice === questions[index].correct
    advance(correct ? 'correct' : 'incorrect')
  }

  if (done) {
    const correctCount = results.filter((r) => r === 'correct').length
    const ratio = correctCount / questions.length
    return (
      <PracticeDone
        topicId={topicId}
        title="Speed round done"
        detail={`${correctCount} out of ${questions.length} correct.`}
        icon={
          ratio >= 0.8 ? <Zap className="h-11 w-11 text-lightning" aria-hidden />
            : ratio >= 0.6 ? <Target className="h-11 w-11 text-brand-700" aria-hidden />
              : <RefreshCw className="h-11 w-11 text-ink-2" aria-hidden />
        }
        extra={
          <div className="my-4 flex flex-wrap justify-center gap-1.5" aria-hidden>
            {results.map((r, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  r === 'correct' ? 'bg-correct' : r === 'timeout' ? 'bg-black/20' : 'bg-incorrect'
                }`}
              />
            ))}
          </div>
        }
        secondary={
          <PracticeSecondaryButton
            onClick={() => {
              setIndex(0); setAnswerState('unanswered')
              setTimeLeft(timeLimit); setResults([]); setDone(false); setStreak(0)
            }}
          >
            Play again
          </PracticeSecondaryButton>
        }
      />
    )
  }

  const q = questions[index]
  const timerPct = (timeLeft / timeLimit) * 100
  // Urgency label for the screen reader timer announcement
  const timerLabel = timerPct > 50 ? 'plenty of time' : timerPct > 25 ? 'hurry up' : 'almost out of time'
  // Tailwind class-based colour — avoids both hardcoded hex and CSS variable strings in style props
  const timerBarClass = timerPct > 50 ? 'bg-correct' : timerPct > 25 ? 'bg-lightning' : 'bg-incorrect'

  return (
    <div className="space-y-4">
      <PracticeHeader
        title={config.title}
        current={index + 1}
        total={questions.length}
        aside={
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-ink-2">
              {index + 1} of {questions.length}
            </span>
            <span
              className={[
                'rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums',
                timerPct > 50
                  ? 'bg-correct/20 text-correct-700'
                  : timerPct > 25
                    ? 'bg-lightning/20 text-points-gold-700'
                    : 'bg-incorrect/20 text-incorrect-700',
              ].join(' ')}
              aria-hidden="true"
            >
              {timeLeft}s
            </span>
          </span>
        }
      />

      {/* Timer bar — role=timer so screen readers can track it */}
      <div
        className="h-2 overflow-hidden rounded-full bg-black/[0.08]"
        role="timer"
        aria-label={`${timeLeft} seconds remaining, ${timerLabel}`}
        aria-live="off"
      >
        <motion.div
          className={`h-full rounded-full transition-colors ${timerBarClass}`}
          style={{ width: `${timerPct}%` }}
          transition={{ duration: 0.3 }}
          aria-hidden="true"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18 }}
          className="rounded-2xl border border-black/[0.07] bg-surface p-5 shadow-sm"
        >
          <p className="mb-4 text-xs text-ink-2">{config.instructions}</p>

          <p className="mb-5 text-center font-heading text-xl font-bold text-ink leading-snug">
            <MathText text={q.question} />
          </p>

          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Answer choices">
            {options[index].map((opt) => {
              const isCorrectOpt = opt === q.correct
              const isWrongPick = opt !== q.correct && answerState === 'incorrect'
              let cls = 'border-black/15 bg-surface text-ink hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
              if (answerState !== 'unanswered') {
                if (isCorrectOpt) cls = 'border-correct bg-correct/10 text-correct-700 font-bold'
                else if (isWrongPick) cls = 'border-incorrect/40 bg-incorrect/5 text-muted'
              }
              let ariaLabel = opt
              if (answerState !== 'unanswered') {
                if (isCorrectOpt) ariaLabel = `${opt}, correct answer`
                else if (isWrongPick) ariaLabel = `${opt}, incorrect`
              }
              return (
                <button
                  key={opt}
                  onClick={() => answer(opt)}
                  disabled={answerState !== 'unanswered'}
                  aria-label={ariaLabel}
                  className={[
                    'min-h-[56px] rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors',
                    cls,
                  ].join(' ')}
                >
                  <MathText text={opt} />
                </button>
              )
            })}
          </div>

          <div aria-live="polite" aria-atomic="true">
            <AnimatePresence>
              {answerState === 'timeout' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 text-center text-sm font-bold text-ink-2"
                >
                  <span className="flex items-center justify-center gap-1"><Clock className="w-4 h-4" aria-hidden /> Time&apos;s up! The answer was: <MathText text={q.correct} /></span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots — decorative; screen readers use the "X / Y" counter above */}
      <div className="flex justify-center gap-1" aria-hidden="true">
        {questions.map((_, i) => (
          <div
            key={i}
            className={[
              'h-2 w-2 rounded-full',
              i < results.length
                ? results[i] === 'correct' ? 'bg-correct' : 'bg-incorrect'
                : i === index ? 'bg-brand' : 'bg-black/15',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
