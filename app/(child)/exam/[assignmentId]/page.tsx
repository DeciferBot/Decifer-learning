'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ExamTimer } from '@/components/quiz/ExamTimer'
import { stableChoiceOrder } from '@/lib/quiz/stable-order'
import { HintButton } from '@/components/quiz/HintButton'
import { TrueFalseGrid, type TrueFalseStatement } from '@/components/quiz/TrueFalseGrid'
import { OrderedList, type OrderedListItem } from '@/components/quiz/OrderedList'
import SourceAnalysis, { type SourceAnalysisSubQ } from '@/components/quiz/SourceAnalysis'
import MathText from '@/components/ui/MathText'
import { Check, CircleX, ClipboardList, AlertTriangle } from '@/components/ui/icons'
import type { ExamQuestion } from '@/lib/exam'

type TFResult = { allCorrect: boolean; correctCount: number; totalCount: number }

type AnswerRecord = {
  questionId: string
  topicId: string
  childAnswer: string
  wasCorrect: boolean
  timeSeconds: number
}

type AttemptState = {
  attemptId: string
  startedAt: string
  timeLimitMinutes: number
  hintsAllowed: boolean
  questions: ExamQuestion[]
}

export default function ExamSessionPage({
  params,
}: {
  params: { assignmentId: string }
}) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'confirm' | 'active' | 'submitting' | 'done' | 'error' | 'already_done'>(
    'loading',
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [attempt, setAttempt] = useState<AttemptState | null>(null)

  // Active exam state
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [fillAnswer, setFillAnswer] = useState('')
  const [revealedHints, setRevealedHints] = useState<string[]>([])
  const questionStartRef = useRef(Date.now())
  const examStartRef = useRef(Date.now())
  const autoSubmitRef = useRef(false)

  // Check for existing attempt on mount
  useEffect(() => {
    fetch('/api/exam/child')
      .then((r) => r.json())
      .then((d) => {
        const assignment = (d.assignments ?? []).find(
          (a: { id: string; attempts: { id: string; status: string }[] }) =>
            a.id === params.assignmentId,
        )
        if (!assignment) { setErrorMsg('Exam not found.'); setState('error'); return }
        const existingAttempt = assignment.attempts?.[0]
        if (existingAttempt && existingAttempt.status !== 'in_progress') {
          setState('already_done')
          return
        }
        setState('confirm')
      })
      .catch(() => { setErrorMsg('Could not load exam.'); setState('error') })
  }, [params.assignmentId])

  const startExam = useCallback(async () => {
    setState('loading')
    const res = await fetch('/api/exam/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: params.assignmentId }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.error === 'already_attempted') { setState('already_done'); return }
      setErrorMsg(data.error ?? 'Could not start exam.'); setState('error'); return
    }
    setAttempt({
      attemptId: data.attemptId,
      startedAt: data.startedAt,
      timeLimitMinutes: data.timeLimitMinutes,
      hintsAllowed: data.hintsAllowed,
      questions: data.questions,
    })
    examStartRef.current = Date.now()
    questionStartRef.current = Date.now()
    setState('active')
  }, [params.assignmentId])

  const submitExam = useCallback(
    async (currentAnswers: AnswerRecord[]) => {
      if (!attempt || autoSubmitRef.current) return
      autoSubmitRef.current = true
      setState('submitting')
      const timeTakenSeconds = Math.round((Date.now() - examStartRef.current) / 1000)
      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt.attemptId,
          answers: currentAnswers,
          timeTakenSeconds,
        }),
      })
      if (res.ok) {
        router.push(`/exam/${params.assignmentId}/result?attemptId=${attempt.attemptId}`)
      } else {
        setErrorMsg('Could not submit exam. Your answers are saved, please try again.')
        setState('error')
      }
    },
    [attempt, params.assignmentId, router],
  )

  const handleTimerExpire = useCallback(() => {
    submitExam(answers)
  }, [submitExam, answers])

  const currentQuestion = attempt?.questions[questionIndex]

  function recordAnswer(childAnswer: string, wasCorrect: boolean) {
    if (!currentQuestion) return
    const timeSeconds = Math.round((Date.now() - questionStartRef.current) / 1000)
    const newAnswers = [
      ...answers,
      {
        questionId: currentQuestion.id,
        topicId: currentQuestion.topic_id,
        childAnswer,
        wasCorrect,
        timeSeconds,
      },
    ]
    setAnswers(newAnswers)
    setSubmitted(true)

    // Auto-advance after 1.5s
    setTimeout(() => {
      const nextIndex = questionIndex + 1
      if (!attempt) return
      if (nextIndex >= attempt.questions.length) {
        submitExam(newAnswers)
      } else {
        setQuestionIndex(nextIndex)
        setSelectedChoice(null)
        setFillAnswer('')
        setSubmitted(false)
        setRevealedHints([])
        questionStartRef.current = Date.now()
      }
    }, 1500)
  }

  function handleMultipleChoiceSelect(choice: string) {
    if (submitted) return
    setSelectedChoice(choice)
  }

  function handleMultipleChoiceSubmit() {
    if (!currentQuestion || !selectedChoice || submitted) return
    const correct =
      selectedChoice.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase()
    recordAnswer(selectedChoice, correct)
  }

  function handleFillSubmit() {
    if (!currentQuestion || submitted) return
    const trimmed = fillAnswer.trim()
    if (!trimmed) return
    const correct = trimmed.toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase()
    recordAnswer(trimmed, correct)
  }

  function handleMultiPartAnswer(result: TFResult) {
    recordAnswer('multi_part', result.allCorrect)
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  if (state === 'already_done') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Check className="h-12 w-12 text-correct-700" aria-hidden />
        <h1 className="font-heading text-xl font-bold text-ink">Exam already completed</h1>
        <p className="text-sm text-muted">This exam can only be taken once.</p>
        <a href="/exam" className="rounded-xl bg-brand/10 px-5 py-2.5 text-sm font-bold text-on-maths">
          Back to exams
        </a>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-incorrect-700" aria-hidden />
        <h1 className="font-heading text-xl font-bold text-ink">Something went wrong</h1>
        <p className="text-sm text-muted">{errorMsg}</p>
        <a href="/exam" className="rounded-xl bg-brand/10 px-5 py-2.5 text-sm font-bold text-on-maths">
          Back to exams
        </a>
      </div>
    )
  }

  if (state === 'confirm') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <ClipboardList className="h-12 w-12 text-on-maths" aria-hidden />
        <h1 className="font-heading text-2xl font-bold text-ink">Ready to start?</h1>
        <div className="rounded-2xl border border-black/5 bg-surface px-6 py-5 text-left space-y-2 w-full max-w-sm shadow-sm">
          <p className="text-sm text-ink"><span className="font-semibold">This exam is timed.</span></p>
          <p className="text-sm text-muted">Once you start, the clock counts down. Questions are drawn from across the whole subject.</p>
          <p className="text-sm text-muted">You cannot go back to a previous question. There are no hearts.</p>
          <p className="text-sm text-muted font-medium text-ink">This exam can only be taken once.</p>
        </div>
        <button
          onClick={startExam}
          className="w-full max-w-sm rounded-2xl bg-brand-600 py-4 font-heading text-base font-bold text-white transition-colors hover:bg-brand-700 min-h-[56px]"
        >
          Start exam
        </button>
        <a href="/exam" className="text-sm text-muted underline underline-offset-2">
          Not now
        </a>
      </div>
    )
  }

  if (state === 'submitting') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted">Submitting your answers…</p>
      </div>
    )
  }

  if (!attempt || !currentQuestion) return null

  const totalQ = attempt.questions.length
  const progress = ((questionIndex) / totalQ) * 100

  const distractors: string[] = Array.isArray(currentQuestion.distractors)
    ? (currentQuestion.distractors as string[])
    : []
  // One shared rule for the order of answer buttons, everywhere. See
  // lib/quiz/stable-order.ts for why a random order was actively harmful.
  //
  // Worked out fresh each time rather than remembered. Remembering it would need a
  // React hook, and there are five early exits above this line, so a hook here
  // would be skipped on some renders and not others — which React forbids and which
  // breaks the screen. The calculation is a handful of sums on four short strings,
  // and it now gives the same answer every time, so repeating it costs nothing.
  const choices = distractors.includes(currentQuestion.correct_answer)
    ? stableChoiceOrder(currentQuestion.id, distractors[0], distractors.slice(1))
    : stableChoiceOrder(currentQuestion.id, currentQuestion.correct_answer, distractors)

  const isMultiPart = ['true_false_grid', 'ordered_list', 'source_analysis'].includes(
    currentQuestion.question_type,
  )

  // Does this question offer answers to choose between?
  //
  // This used to ask whether the question type was the word "multiple_choice" —
  // and NO question has ever been given that name. Every question in every exam,
  // including thousands with four perfectly good answers, was therefore shown as
  // an empty box the child had to type the exact answer into. Asking whether there
  // are wrong answers to show is the question that was always meant.
  const hasChoices = choices.length >= 2

  // On a picture question the words behind each button are the picture's own
  // description, so the button shows the picture and is named by the description.
  const answerPictures: Record<string, { url: string; alt: string }> =
    currentQuestion.option_images && typeof currentQuestion.option_images === 'object'
      ? Object.fromEntries(
          Object.entries(currentQuestion.option_images as Record<string, unknown>)
            .filter(([, v]) => v && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string')
            .map(([k, v]) => [k, v as { url: string; alt: string }]),
        )
      : {}

  return (
    <div className="flex min-h-[100dvh] flex-col pb-6">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/5 bg-surface/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="text-sm font-semibold text-muted">
            {questionIndex + 1} / {totalQ}
          </span>
          <div className="flex-1 mx-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-teal transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <ExamTimer
            timeLimitMinutes={attempt.timeLimitMinutes}
            onExpire={handleTimerExpire}
          />
        </div>
      </header>

      {/* Question */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-2xl space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* Topic label */}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {currentQuestion.topic_title}
              </p>

              {/* Question text */}
              <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm">
                <MathText
                  text={currentQuestion.question_text}
                  className="font-heading text-base font-semibold text-ink leading-relaxed"
                />
              </div>

              {/* Hint (if allowed) */}
              {attempt.hintsAllowed && (currentQuestion.hint_1 || currentQuestion.hint_2 || currentQuestion.hint_3) && (
                <HintButton
                  hints={[
                    currentQuestion.hint_1 ?? '',
                    currentQuestion.hint_2 ?? '',
                    currentQuestion.hint_3 ?? '',
                  ].filter(Boolean)}
                  revealed={revealedHints}
                  onReveal={() => {
                    const allHints = [currentQuestion.hint_1, currentQuestion.hint_2, currentQuestion.hint_3].filter(Boolean) as string[]
                    const next = allHints[revealedHints.length]
                    if (next) setRevealedHints([...revealedHints, next])
                  }}
                  disabled={submitted}
                />
              )}

              {/* Answers */}
              {currentQuestion.question_type === 'true_false_grid' ? (
                <TrueFalseGrid
                  statements={(currentQuestion.answer_parts as TrueFalseStatement[]) ?? []}
                  onAnswer={handleMultiPartAnswer}
                  disabled={submitted}
                />
              ) : currentQuestion.question_type === 'ordered_list' ? (
                <OrderedList
                  items={(currentQuestion.answer_parts as OrderedListItem[]) ?? []}
                  onAnswer={handleMultiPartAnswer}
                  disabled={submitted}
                />
              ) : currentQuestion.question_type === 'source_analysis' ? (
                <SourceAnalysis
                  sourceText={currentQuestion.source_text ?? ''}
                  sourceLabel={currentQuestion.source_label ?? ''}
                  sourceType={(currentQuestion.source_type as 'quote' | 'table' | 'graph_description') ?? 'quote'}
                  subQuestions={(currentQuestion.answer_parts as SourceAnalysisSubQ[]) ?? []}
                  onAnswer={handleMultiPartAnswer}
                  disabled={submitted}
                />
              ) : hasChoices ? (
                <div className="space-y-2.5">
                  {choices.map((choice) => {
                    const isSelected = selectedChoice === choice
                    const isCorrect = choice.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase()
                    let bg = 'bg-surface border-black/10 hover:border-brand/40'
                    if (submitted) {
                      bg = isCorrect
                        ? 'bg-correct/10 border-correct/40'
                        : isSelected
                        ? 'bg-incorrect/10 border-incorrect/40'
                        : 'bg-surface border-black/5 opacity-50'
                    } else if (isSelected) {
                      bg = 'bg-brand/10 border-brand'
                    }
                    return (
                      <button
                        // Keyed by question as well as answer: picture questions all
                        // use the letters A to D, so the answer alone no longer tells
                        // one question's buttons from another's.
                        key={`${currentQuestion.id}:${choice}`}
                        onClick={() => handleMultipleChoiceSelect(choice)}
                        disabled={submitted}
                        aria-label={answerPictures[choice]?.alt}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium text-ink transition-colors min-h-[52px] ${bg}`}
                      >
                        {answerPictures[choice] ? (
                          <img
                            src={answerPictures[choice].url}
                            // Named by the button above; saying it twice helps nobody.
                            alt=""
                            className="h-24 w-full rounded-lg object-contain"
                          />
                        ) : (
                          <MathText text={choice} />
                        )}
                      </button>
                    )
                  })}
                  {!submitted && selectedChoice && (
                    <button
                      onClick={handleMultipleChoiceSubmit}
                      className="mt-1 w-full rounded-xl bg-brand-600 transition-colors hover:bg-brand-700 py-3 text-sm font-bold text-white min-h-[52px]"
                    >
                      Confirm
                    </button>
                  )}
                </div>
              ) : (
                // fill_blank / short_answer / numeric / other
                <div className="space-y-3">
                  <input
                    type={currentQuestion.question_type === 'numeric' ? 'number' : 'text'}
                    value={fillAnswer}
                    onChange={(e) => setFillAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFillSubmit()
                    }}
                    disabled={submitted}
                    placeholder="Your answer…"
                    className="w-full rounded-xl border border-black/10 bg-surface px-4 py-3 text-sm text-ink placeholder-muted focus:border-brand focus:outline-none min-h-[52px]"
                  />
                  {!submitted && (
                    <button
                      onClick={handleFillSubmit}
                      disabled={!fillAnswer.trim()}
                      className="w-full rounded-xl bg-brand-600 transition-colors hover:bg-brand-700 py-3 text-sm font-bold text-white disabled:opacity-40 min-h-[52px]"
                    >
                      Confirm
                    </button>
                  )}
                </div>
              )}

              {/* Feedback after answering */}
              {submitted && !isMultiPart && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
                    answers[answers.length - 1]?.wasCorrect
                      ? 'bg-correct/10'
                      : 'bg-incorrect/10'
                  }`}
                >
                  {answers[answers.length - 1]?.wasCorrect ? (
                    <Check className="mt-0.5 h-4 w-4 flex-none text-correct-700" aria-hidden />
                  ) : (
                    <CircleX className="mt-0.5 h-4 w-4 flex-none text-incorrect-700" aria-hidden />
                  )}
                  <div>
                    {!answers[answers.length - 1]?.wasCorrect && (
                      <p className="text-sm text-ink">
                        <span className="font-semibold">Answer: </span>
                        {/* On a picture question the stored answer is a letter, so
                            the picture is what gets shown. */}
                        {answerPictures[currentQuestion.correct_answer] ? (
                          <img
                            src={answerPictures[currentQuestion.correct_answer].url}
                            alt={answerPictures[currentQuestion.correct_answer].alt}
                            className="mt-1 h-24 w-full rounded-lg bg-surface object-contain"
                          />
                        ) : (
                          <MathText text={currentQuestion.correct_answer} />
                        )}
                      </p>
                    )}
                    {currentQuestion.explanation && (
                      <p className="mt-0.5 text-xs text-muted"><MathText text={currentQuestion.explanation} /></p>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
