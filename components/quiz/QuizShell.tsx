'use client'

import { useEffect, useRef, useState } from 'react'
import { submitAnswer } from '@/lib/offline'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { HintButton } from './HintButton'
import { HeartsDisplay } from './HeartsDisplay'
import { CardReveal } from '@/components/cards/CardReveal'
import { BadgePopup } from '@/components/quiz/BadgePopup'
import type { DroppedCard, EarnedBadge } from '@/app/api/quiz/submit/route'

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

type AnswerLog = {
  questionId: string
  childAnswer: string
  wasCorrect: boolean
  hintNumber: number
  timeSeconds: number
}

type SubmitResult = {
  points: number
  passed: boolean
  score: number
  totalQuestions: number
  totalPoints: number
  streakDays: number
  newStreak: boolean
  droppedCard: DroppedCard | null
  newBadges: EarnedBadge[]
  shieldAwarded: boolean
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

const MAX_HEARTS = 3
const CONSECUTIVE_WRONG_FOR_HEART_LOSS = 3

export function QuizShell({
  questions,
  topicId,
  initialShields = 0,
  submitUrl = '/api/quiz/submit',
  backHref = '/dashboard/child',
  backLabel = 'Back to Home',
  winMessage = 'Topic complete!',
}: {
  questions: QuizQuestion[]
  topicId: string | null
  initialShields?: number
  submitUrl?: string
  backHref?: string
  backLabel?: string
  winMessage?: string
}) {
  const [qIndex, setQIndex] = useState(0)
  const [choices, setChoices] = useState<string[]>(() => buildInitialChoices(questions[0]))
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [hintsRevealed, setHintsRevealed] = useState(0)

  // Hearts + streak shields
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [shields, setShields] = useState(initialShields)
  const [consecutiveWrong, setConsecutiveWrong] = useState(0)
  const [heartsDead, setHeartsDead] = useState(false)
  const [shieldFlash, setShieldFlash] = useState(false)

  // Quiz completion + submission
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [submittedOffline, setSubmittedOffline] = useState(false)

  // Post-result overlays
  const [showCard, setShowCard] = useState(false)
  const [badgeQueue, setBadgeQueue] = useState<EarnedBadge[]>([])

  // Refs
  const answerLogRef = useRef<AnswerLog[]>([])
  const questionStartRef = useRef(Date.now())
  const quizStartRef = useRef(Date.now())
  const heartsAtDoneRef = useRef(MAX_HEARTS)

  const q = questions[qIndex]
  const hints = [q.hint_1, q.hint_2, q.hint_3].filter((h): h is string => h !== null)
  const revealedHints = hints.slice(0, hintsRevealed)

  function pick(choice: string) {
    if (answered) return
    const isCorrect = choice === q.correct_answer
    const timeSeconds = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000))

    setSelected(choice)
    setAnswered(true)
    if (isCorrect) {
      setScore((s) => s + 1)
      setConsecutiveWrong(0)
    } else {
      // Read current values directly — safe in event handlers (never double-invoked
      // by React Strict Mode, unlike setState updater functions).
      const next = consecutiveWrong + 1
      if (next >= CONSECUTIVE_WRONG_FOR_HEART_LOSS) {
        if (shields > 0) {
          // Shield absorbs the heart loss. Call the API exactly once here,
          // outside any setState updater, to prevent the double-invocation
          // that Strict Mode applies to updater callbacks.
          setShields(shields - 1)
          setShieldFlash(true)
          setTimeout(() => setShieldFlash(false), 800)
          fetch('/api/streak/shields/use', { method: 'POST' }).catch(() => null)
        } else {
          // No shield — lose a heart
          const newH = hearts - 1
          heartsAtDoneRef.current = newH
          setHearts(newH)
          if (newH <= 0) setHeartsDead(true)
        }
        setConsecutiveWrong(0)
      } else {
        setConsecutiveWrong(next)
      }
    }

    answerLogRef.current.push({
      questionId: q.id,
      childAnswer: choice,
      wasCorrect: isCorrect,
      hintNumber: hintsRevealed,
      timeSeconds,
    })
  }

  function revealNextHint() {
    if (hintsRevealed < hints.length) setHintsRevealed((n) => n + 1)
  }

  function next() {
    const nextIdx = qIndex + 1
    if (nextIdx >= questions.length) {
      heartsAtDoneRef.current = hearts
      setDone(true)
      return
    }
    const nextQ = questions[nextIdx]
    setChoices(buildInitialChoices(nextQ))
    setQIndex(nextIdx)
    setSelected(null)
    setAnswered(false)
    setHintsRevealed(0)
    questionStartRef.current = Date.now()
  }

  function restart() {
    setQIndex(0)
    setChoices(buildInitialChoices(questions[0]))
    setSelected(null)
    setAnswered(false)
    setScore(0)
    setDone(false)
    setHeartsDead(false)
    setHearts(MAX_HEARTS)
    setShields(initialShields)
    setConsecutiveWrong(0)
    setHintsRevealed(0)
    setSubmitting(false)
    setSubmitResult(null)
    setSubmittedOffline(false)
    setShowCard(false)
    setBadgeQueue([])
    answerLogRef.current = []
    questionStartRef.current = Date.now()
    quizStartRef.current = Date.now()
    heartsAtDoneRef.current = MAX_HEARTS
  }

  // Submit to API when quiz is done
  useEffect(() => {
    if (!done) return
    setSubmitting(true)
    const timeTakenSeconds = Math.max(1, Math.round((Date.now() - quizStartRef.current) / 1000))
    const submitBody: Record<string, unknown> = {
      answers: answerLogRef.current,
      timeTakenSeconds,
      heartsRemaining: heartsAtDoneRef.current,
    }
    if (topicId !== null) submitBody.topicId = topicId
    submitAnswer(submitUrl, submitBody)
      .then((res) => (res ? res.json() : null))
      .then((data: SubmitResult | null) => {
        if (data) {
          setSubmitResult(data)
          if (data.passed && data.droppedCard) setShowCard(true)
          else if (data.newBadges?.length) setBadgeQueue(data.newBadges)
        } else {
          setSubmittedOffline(true)
        }
        setSubmitting(false)
      })
      .catch(() => setSubmitting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // ── Card reveal dismissed → show badges ──────────────────────────────────
  function onCardDismissed() {
    setShowCard(false)
    if (submitResult?.newBadges?.length) setBadgeQueue(submitResult.newBadges)
  }

  // ── Badge dismissed → show next badge ────────────────────────────────────
  function onBadgeDismissed() {
    setBadgeQueue((q) => q.slice(1))
  }

  // ── Hearts dead → retry screen ───────────────────────────────────────────
  if (heartsDead) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="mb-3 text-5xl">💔</div>
        <h2 className="font-heading text-2xl font-bold text-ink">Out of hearts!</h2>
        <p className="mt-2 text-muted">Don&apos;t worry — no score saved. Give it another go!</p>
        <button
          onClick={restart}
          className="mt-6 min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
        >
          Try Again
        </button>
      </motion.div>
    )
  }

  // ── Quiz done → result screen ─────────────────────────────────────────────
  if (done) {
    const localScore = score
    const localTotal = questions.length
    const pct = Math.round((localScore / localTotal) * 100)
    const passed = pct >= 70
    const points = submitResult?.points
    const totalPoints = submitResult?.totalPoints
    const streakDays = submitResult?.streakDays
    const shieldAwarded = submitResult?.shieldAwarded

    return (
      <>
        {/* Card reveal overlay */}
        {showCard && submitResult?.droppedCard && (
          <CardReveal card={submitResult.droppedCard} onDismiss={onCardDismissed} />
        )}

        {/* Badge popup (shown after card dismissed) */}
        {!showCard && badgeQueue.length > 0 && (
          <BadgePopup badge={badgeQueue[0]} onDismiss={onBadgeDismissed} />
        )}

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
            {localScore} / {localTotal}
          </p>
          <p className="mt-1 text-muted">
            {pct}% — {passed ? winMessage : 'Try again to improve your score.'}
          </p>

          {submitting ? (
            <p className="mt-4 text-sm text-muted">Saving results…</p>
          ) : submittedOffline ? (
            <p className="mt-4 text-sm text-muted">
              Saved offline — your points will sync when you reconnect.
            </p>
          ) : (
            <div className="mt-4 space-y-1">
              {typeof points === 'number' && (
                <p className="font-heading font-bold" style={{ color: '#FFC107' }}>
                  +{points} points earned
                </p>
              )}
              {typeof totalPoints === 'number' && (
                <p className="text-sm text-muted">Total: {totalPoints.toLocaleString()} pts</p>
              )}
              {typeof streakDays === 'number' && streakDays > 0 && (
                <p className="text-sm text-muted">🔥 {streakDays} day streak</p>
              )}
              {shieldAwarded && (
                <p className="text-sm font-bold" style={{ color: '#74C0FC' }}>
                  🛡️ Streak Shield awarded!
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {passed && (
              <Link
                href="/collection"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-black/10 px-6 py-3 font-heading font-bold text-maths transition-colors hover:bg-maths/10"
              >
                View Collection
              </Link>
            )}
            {!passed && (
              <button
                onClick={restart}
                className="min-h-[48px] rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
              >
                Try Again
              </button>
            )}
            <Link
              href={backHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-black/10 px-6 py-3 font-heading font-bold text-ink transition-colors hover:bg-black/5"
            >
              {backLabel}
            </Link>
          </div>
        </motion.div>
      </>
    )
  }

  // ── Active quiz ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <HeartsDisplay hearts={hearts} />
        <div className="flex items-center gap-3">
          {shields > 0 && (
            <motion.span
              animate={shieldFlash ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 0.4 }}
              className="text-sm font-bold"
              style={{ color: '#74C0FC' }}
              title="Streak Shields — absorb 1 heart loss each"
            >
              🛡️ ×{shields}
            </motion.span>
          )}
          <span className="text-sm font-bold text-ink">Score: {score}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {qIndex + 1} of {questions.length}
        </span>
        {consecutiveWrong > 0 && (
          <span className="text-xs" style={{ color: '#FF6B6B' }}>
            {CONSECUTIVE_WRONG_FOR_HEART_LOSS - consecutiveWrong} more wrong = {shields > 0 ? '🛡️' : '❤️'} lost
          </span>
        )}
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
                  style={{ color: selected === q.correct_answer ? '#40C057' : '#FF6B6B' }}
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

          {answered && !heartsDead && (
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
