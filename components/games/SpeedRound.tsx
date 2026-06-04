'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Zap, Target, RefreshCw, Clock } from '@/components/ui/icons'

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const advance = useCallback(
    (state: AnswerState) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setAnswerState(state)
      const newResults = [...results, state]
      setTimeout(() => {
        if (index + 1 >= questions.length) {
          setResults(newResults)
          setDone(true)
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

  // Timer
  useEffect(() => {
    if (answerState !== 'unanswered' || done) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          advance('timeout')
          return 0
        }
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
    const pct = Math.round((correctCount / questions.length) * 100)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="flex justify-center mb-3">
          {pct >= 80 ? <Zap className="w-12 h-12 text-lightning" aria-hidden /> : pct >= 60 ? <Target className="w-12 h-12 text-maths" aria-hidden /> : <RefreshCw className="w-12 h-12 text-muted" aria-hidden />}
        </div>
        <h2 className="font-heading text-2xl font-bold text-ink">Speed Round Done!</h2>
        <p className="mt-1 text-muted">
          {correctCount} / {questions.length} correct · {pct}%
        </p>
        {/* Result strip */}
        <div className="my-4 flex justify-center gap-1">
          {results.map((r, i) => (
            <div
              key={i}
              className={[
                'h-3 w-3 rounded-full',
                r === 'correct' ? 'bg-correct' : r === 'timeout' ? 'bg-black/20' : 'bg-incorrect',
              ].join(' ')}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href={`/topics/${topicId}/quiz`}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Start the Quiz →
          </Link>
          <button
            onClick={() => {
              setIndex(0); setAnswerState('unanswered')
              setTimeLeft(timeLimit); setResults([]); setDone(false)
            }}
            className="min-h-[48px] w-full rounded-xl border-2 border-maths px-6 py-3 font-heading font-bold text-maths transition-opacity hover:opacity-80"
          >
            Play Again
          </button>
        </div>
      </motion.div>
    )
  }

  const q = questions[index]
  const timerPct = (timeLeft / timeLimit) * 100
  const timerColor = timerPct > 50 ? '#40C057' : timerPct > 25 ? '#FFD43B' : '#FF6B6B'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{config.title}</span>
        <span>{index + 1} / {questions.length}</span>
      </div>

      {/* Timer bar */}
      <div className="h-2 overflow-hidden rounded-full bg-black/8">
        <motion.div
          className="h-full rounded-full transition-colors"
          style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18 }}
          className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm"
        >
          {/* Timer badge */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted">{config.instructions}</p>
            <span
              className="rounded-full px-3 py-1 font-heading text-sm font-bold"
              style={{ backgroundColor: timerColor + '22', color: timerColor }}
            >
              {timeLeft}s
            </span>
          </div>

          <p className="mb-5 text-center font-heading text-xl font-bold text-ink leading-snug">
            {q.question}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {options[index].map((opt) => {
              let cls = 'border-black/15 bg-white text-ink hover:border-maths'
              if (answerState !== 'unanswered') {
                if (opt === q.correct) cls = 'border-correct bg-correct/10 text-correct font-bold'
                else if (opt !== q.correct && answerState === 'incorrect') cls = 'border-incorrect/40 bg-incorrect/5 text-muted'
              }
              return (
                <button
                  key={opt}
                  onClick={() => answer(opt)}
                  disabled={answerState !== 'unanswered'}
                  className={[
                    'min-h-[56px] rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors',
                    cls,
                  ].join(' ')}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          <AnimatePresence>
            {answerState === 'timeout' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-center text-sm font-bold text-muted"
              >
                <span className="flex items-center justify-center gap-1"><Clock className="w-4 h-4" aria-hidden /> Time&apos;s up! The answer was: {q.correct}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="flex justify-center gap-1">
        {questions.map((_, i) => (
          <div
            key={i}
            className={[
              'h-2 w-2 rounded-full',
              i < results.length
                ? results[i] === 'correct' ? 'bg-correct' : 'bg-incorrect'
                : i === index ? 'bg-maths' : 'bg-black/15',
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
