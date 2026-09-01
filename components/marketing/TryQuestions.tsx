'use client'

// Five real questions, answerable by anyone, with no account.
//
// Everything is checked in the browser and nothing is saved. A logged-out
// visitor is not a child we have consent for, so we do not record who answered
// what. The score lives until they close the tab, which is all it needs to do.

import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Surface'
import MathText from '@/components/ui/MathText'
import type { PublicTryQuestion } from '@/lib/public-curriculum'

interface Props {
  questions: PublicTryQuestion[]
  topicTitle: string
  yearLabel: string
  subjectName: string
  /** Outer spacing. The topic pages sit it under a long lesson list; /try puts it first. */
  className?: string
}

export function TryQuestions({ questions, topicTitle, yearLabel, subjectName, className = 'mt-12' }: Props) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  const question = questions[index]
  const isLast = index === questions.length - 1
  const wasRight = picked !== null && picked === question?.answer

  function choose(option: string) {
    if (picked !== null) return
    setPicked(option)
    if (option === question.answer) setCorrectCount((n) => n + 1)
  }

  function next() {
    if (isLast) {
      setFinished(true)
      return
    }
    setIndex((i) => i + 1)
    setPicked(null)
  }

  function restart() {
    setIndex(0)
    setPicked(null)
    setCorrectCount(0)
    setFinished(false)
  }

  if (finished) {
    return (
      <Card tone="brand" lift="floating" className={`${className} p-8 text-center`}>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">Your score</p>
        <p className="mt-2 font-heading text-4xl font-bold text-ink">
          {correctCount} out of {questions.length}
        </p>
        <p className="mx-auto mt-3 max-w-md text-muted">
          {correctCount === questions.length
            ? `Every one right. There is a lot more ${topicTitle} where that came from.`
            : `That is a start. Decifer works out which bits need another go, then keeps bringing them back until they stick.`}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/register" size="lg" className="w-full sm:w-auto">
            Keep going, free
          </ButtonLink>
          <Button variant="secondary" size="lg" onClick={restart} className="w-full sm:w-auto">
            Try again
          </Button>
        </div>
      </Card>
    )
  }

  if (!question) return null

  return (
    <Card lift="floating" className={`${className} p-6 sm:p-8`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-bold text-ink">Try it now</h2>
        <span className="text-sm text-muted">
          Question {index + 1} of {questions.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Real {yearLabel} {subjectName} questions. No account needed.
      </p>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-label="Progress through the questions"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-300"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <p className="mt-6 text-lg font-semibold leading-relaxed text-ink">
        <MathText text={question.question} />
      </p>

      <ul className="mt-5 space-y-2.5">
        {question.options.map((option) => {
          const isAnswer = option === question.answer
          const isPicked = option === picked
          const answered = picked !== null

          let tone = 'border-black/10 bg-surface hover:bg-black/[0.03]'
          if (answered && isAnswer) tone = 'border-correct/50 bg-correct/10'
          else if (answered && isPicked) tone = 'border-incorrect/50 bg-incorrect/10'
          else if (answered) tone = 'border-black/10 bg-surface opacity-60'

          return (
            <li key={option}>
              <button
                onClick={() => choose(option)}
                disabled={answered}
                aria-label={
                  answered
                    ? `${option}. ${isAnswer ? 'Correct answer' : isPicked ? 'Your answer, wrong' : ''}`
                    : option
                }
                className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-md border-2 px-4 py-3 text-left text-base font-medium text-ink shadow-clay-sm transition-[transform,box-shadow,background-color,border-color] duration-fast ease-out enabled:active:translate-y-[2px] enabled:active:shadow-clay-pressed enabled:active:duration-instant disabled:cursor-default disabled:shadow-none touch-manipulation select-none motion-reduce:transition-none motion-reduce:active:translate-y-0 ${tone}`}
              >
                <span><MathText text={option} /></span>
                {answered && isAnswer && (
                  <span aria-hidden className="flex-none font-bold text-correct">✓</span>
                )}
                {answered && isPicked && !isAnswer && (
                  <span aria-hidden className="flex-none font-bold text-incorrect">✕</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {picked !== null && (
        <div className="mt-5" role="status">
          <p className={`font-heading text-base font-bold ${wasRight ? 'text-correct' : 'text-incorrect'}`}>
            {wasRight ? 'Correct' : 'Not this time'}
          </p>
          {question.explanation && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              <MathText text={question.explanation} />
            </p>
          )}
          <Button onClick={next} className="mt-5">
            {isLast ? 'See my score' : 'Next question'}
          </Button>
        </div>
      )}
    </Card>
  )
}
