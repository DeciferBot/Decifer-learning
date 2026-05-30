'use client'

import { useEffect, useRef, useState } from 'react'
import { submitAnswer } from '@/lib/offline'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { HintButton } from './HintButton'
import { HeartsDisplay } from './HeartsDisplay'
import { CardReveal } from '@/components/cards/CardReveal'
import { BadgePopup } from '@/components/quiz/BadgePopup'
import { ReportProblemButton } from './ReportProblemButton'
import { WorkedExample } from './WorkedExample'
import { ReflectionPrompt } from './ReflectionPrompt'
import type { DroppedCard, EarnedBadge } from '@/app/api/quiz/submit/route'
import { DifficultyPicker, type DifficultyChoice } from './DifficultyPicker'

// Points awarded per attempt number (1-indexed). Exhausting all attempts = 0.
const POINTS_BY_ATTEMPT = [3, 2, 1] as const
const MAX_ATTEMPTS = 3
const MAX_HEARTS = 3
// Hearts are lost when a question is fully exhausted (all attempts wrong),
// not on individual wrong answers. 3 exhausted questions = 1 heart lost.
const EXHAUSTED_FOR_HEART_LOSS = 3

export type QuizQuestion = {
  id: string
  tier: string
  question_type: string
  question_text: string
  correct_answer: string
  distractors: string[]
  hint_1: string | null
  hint_2: string | null
  hint_3: string | null
  explanation: string | null
  worked_example: string | null
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

function clientShuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shuffleChoices(correct: string, distractors: string[]): string[] {
  return clientShuffle([correct, ...distractors])
}

function buildInitialChoices(q: QuizQuestion): string[] {
  return shuffleChoices(q.correct_answer, q.distractors)
}

// Pick one random index to be the "bonus challenge" question (worth 2× points).
function pickBonusIndex(length: number): number {
  if (length < 3) return -1
  // Avoid first and last question — feels better mid-journey
  const min = 1
  const max = length - 2
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function QuizShell({
  questions,
  topicId,
  topicTitle = 'this topic',
  initialShields = 0,
  submitUrl = '/api/quiz/submit',
  backHref = '/dashboard/child',
  backLabel = 'Back to Home',
  winMessage = 'Topic complete!',
}: {
  questions: QuizQuestion[]
  topicId: string | null
  topicTitle?: string
  initialShields?: number
  submitUrl?: string
  backHref?: string
  backLabel?: string
  winMessage?: string
}) {
  // Difficulty selection — shown before quiz starts
  const [difficulty, setDifficulty] = useState<DifficultyChoice | null>(null)

  // Shuffled + filtered question list — set when child picks difficulty
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([])

  const [qIndex, setQIndex] = useState(0)
  const [choices, setChoices] = useState<string[]>(() => buildInitialChoices(questions[0]))

  // Per-question attempt state
  const [attempts, setAttempts] = useState(0)          // wrong attempts on current question
  const [lastPicked, setLastPicked] = useState<string | null>(null)
  const [questionDone, setQuestionDone] = useState(false)   // answered correctly OR exhausted
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false)
  const [hintsRevealed, setHintsRevealed] = useState(0)

  // Running score (points, not questions correct)
  const [totalPoints, setTotalPoints] = useState(0)
  const [questionsCorrect, setQuestionsCorrect] = useState(0)
  const [pointsFlash, setPointsFlash] = useState<number | null>(null)

  // Challenge milestones
  const [bonusIndex, setBonusIndex] = useState(-1)         // which question is the ⭐ bonus challenge
  const [hintlessStreak, setHintlessStreak] = useState(0)  // correct answers with no hints used
  const [showStreakBonus, setShowStreakBonus] = useState(false)
  const [showHalfway, setShowHalfway] = useState(false)

  // Hearts + streak shields
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [shields, setShields] = useState(initialShields)
  const [exhaustedQuestions, setExhaustedQuestions] = useState(0)
  const [heartsDead, setHeartsDead] = useState(false)
  const [shieldFlash, setShieldFlash] = useState(false)

  // Worked examples — shown on the first question of each question_type in the session.
  const shownWorkedExampleFor = useRef<Set<string>>(new Set())

  // Quiz completion + submission
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [submittedOffline, setSubmittedOffline] = useState(false)

  // Post-result overlays
  const [showCard, setShowCard] = useState(false)
  const [badgeQueue, setBadgeQueue] = useState<EarnedBadge[]>([])
  const [showReflection, setShowReflection] = useState(false)

  // Refs
  const answerLogRef = useRef<AnswerLog[]>([])
  const questionStartRef = useRef(Date.now())
  const quizStartRef = useRef(Date.now())
  const heartsAtDoneRef = useRef(MAX_HEARTS)

  const q = activeQuestions[qIndex] ?? activeQuestions[0]
  const hints = [q.hint_1, q.hint_2, q.hint_3].filter((h): h is string => h !== null)
  const revealedHints = hints.slice(0, hintsRevealed)

  const showWorkedExample =
    !questionDone &&
    attempts === 0 &&
    !!q.worked_example &&
    !shownWorkedExampleFor.current.has(q.question_type)

  function pick(choice: string) {
    if (questionDone) return
    const isCorrect = choice === q.correct_answer
    const timeSeconds = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000))
    const newAttempts = attempts + 1

    setLastPicked(choice)

    answerLogRef.current.push({
      questionId: q.id,
      childAnswer: choice,
      wasCorrect: isCorrect,
      hintNumber: hintsRevealed,
      timeSeconds,
    })

    if (isCorrect) {
      // Points: 3 for first attempt, 2 for second, 1 for third; 2× for bonus challenge
      const basePts = POINTS_BY_ATTEMPT[attempts] ?? 1
      const isBonus = qIndex === bonusIndex
      const pts = isBonus ? basePts * 2 : basePts
      setTotalPoints((p) => p + pts)
      setQuestionsCorrect((n) => n + 1)
      setPointsFlash(pts)
      setTimeout(() => setPointsFlash(null), 1200)
      setAnsweredCorrectly(true)
      setQuestionDone(true)

      // Hintless streak tracking
      if (hintsRevealed === 0) {
        const newStreak = hintlessStreak + 1
        setHintlessStreak(newStreak)
        if (newStreak === 3) {
          // Streak bonus: +5 pts on top
          setTotalPoints((p) => p + 5)
          setShowStreakBonus(true)
          setTimeout(() => setShowStreakBonus(false), 2000)
          setHintlessStreak(0)
        }
      } else {
        setHintlessStreak(0)
      }

      // Halfway celebration
      const midpoint = Math.floor(activeQuestions.length / 2)
      if (qIndex + 1 === midpoint && !showHalfway) {
        setShowHalfway(true)
        setTimeout(() => setShowHalfway(false), 2200)
      }
    } else {
      setAttempts(newAttempts)
      if (newAttempts >= MAX_ATTEMPTS) {
        // Exhausted all attempts
        setQuestionDone(true)
        const newExhausted = exhaustedQuestions + 1
        if (newExhausted >= EXHAUSTED_FOR_HEART_LOSS) {
          if (shields > 0) {
            setShields(shields - 1)
            setShieldFlash(true)
            setTimeout(() => setShieldFlash(false), 800)
            fetch('/api/streak/shields/use', { method: 'POST' }).catch(() => null)
          } else {
            const newH = hearts - 1
            heartsAtDoneRef.current = newH
            setHearts(newH)
            if (newH <= 0) setHeartsDead(true)
          }
          setExhaustedQuestions(0)
        } else {
          setExhaustedQuestions(newExhausted)
        }
      } else {
        // Auto-reveal next hint after a wrong answer
        if (hintsRevealed < hints.length) {
          setHintsRevealed((n) => n + 1)
        }
      }
    }
  }

  function next() {
    if (q.worked_example) shownWorkedExampleFor.current.add(q.question_type)

    const nextIdx = qIndex + 1
    if (nextIdx >= activeQuestions.length) {
      heartsAtDoneRef.current = hearts
      setDone(true)
      return
    }
    const nextQ = activeQuestions[nextIdx]
    setChoices(buildInitialChoices(nextQ))
    setQIndex(nextIdx)
    setLastPicked(null)
    setAttempts(0)
    setQuestionDone(false)
    setAnsweredCorrectly(false)
    setHintsRevealed(0)
    questionStartRef.current = Date.now()
  }

  function restart() {
    setDifficulty(null)
    setActiveQuestions([])
    setBonusIndex(-1)
    setHintlessStreak(0)
    setShowStreakBonus(false)
    setShowHalfway(false)
    setQIndex(0)
    setChoices(buildInitialChoices(questions[0]))
    setLastPicked(null)
    setAttempts(0)
    setQuestionDone(false)
    setAnsweredCorrectly(false)
    setHintsRevealed(0)
    setTotalPoints(0)
    setQuestionsCorrect(0)
    setPointsFlash(null)
    setDone(false)
    setHeartsDead(false)
    setHearts(MAX_HEARTS)
    setShields(initialShields)
    setExhaustedQuestions(0)
    setShieldFlash(false)
    shownWorkedExampleFor.current = new Set()
    setShowReflection(false)
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
          else if (data.passed) setShowReflection(true)
        } else {
          setSubmittedOffline(true)
        }
        setSubmitting(false)
      })
      .catch(() => setSubmitting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function onCardDismissed() {
    setShowCard(false)
    if (submitResult?.newBadges?.length) setBadgeQueue(submitResult.newBadges)
    else if (submitResult?.passed) setShowReflection(true)
  }

  function onBadgeDismissed() {
    const remaining = badgeQueue.slice(1)
    setBadgeQueue(remaining)
    if (remaining.length === 0 && submitResult?.passed) setShowReflection(true)
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
    const pct = Math.round((questionsCorrect / activeQuestions.length) * 100)
    const passed = pct >= 70
    const serverPoints = submitResult?.points
    const serverTotalPoints = submitResult?.totalPoints
    const streakDays = submitResult?.streakDays
    const shieldAwarded = submitResult?.shieldAwarded

    return (
      <>
        {showCard && submitResult?.droppedCard && (
          <CardReveal card={submitResult.droppedCard} onDismiss={onCardDismissed} />
        )}
        {!showCard && badgeQueue.length > 0 && (
          <BadgePopup badge={badgeQueue[0]} onDismiss={onBadgeDismissed} />
        )}
        {showReflection && topicId && (
          <ReflectionPrompt
            topicId={topicId}
            topicTitle={topicTitle}
            onDone={() => setShowReflection(false)}
          />
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
            {questionsCorrect} / {activeQuestions.length}
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
              {typeof serverPoints === 'number' && (
                <p className="font-heading font-bold" style={{ color: '#FFC107' }}>
                  +{serverPoints} points earned
                </p>
              )}
              {typeof serverTotalPoints === 'number' && (
                <p className="text-sm text-muted">Total: {serverTotalPoints.toLocaleString()} pts</p>
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

  // ── Difficulty picker — shown before quiz starts ──────────────────────────
  if (difficulty === null) {
    return (
      <DifficultyPicker
        onPick={(choice) => {
          const base = choice === 'mixed'
            ? questions
            : (() => {
                const f = questions.filter((q) => q.tier === choice)
                return f.length >= 3 ? f : questions
              })()
          // Shuffle client-side so every attempt is a fresh order
          const shuffled = clientShuffle(base)
          setDifficulty(choice)
          setActiveQuestions(shuffled)
          setBonusIndex(pickBonusIndex(shuffled.length))
          setChoices(buildInitialChoices(shuffled[0] ?? questions[0]))
        }}
      />
    )
  }

  // ── Active quiz ───────────────────────────────────────────────────────────
  const attemptsLeft = MAX_ATTEMPTS - attempts
  const isExhausted = questionDone && !answeredCorrectly
  const isBonusQuestion = qIndex === bonusIndex

  return (
    <div className="space-y-4">
      {/* Streak bonus flash */}
      <AnimatePresence>
        {showStreakBonus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            className="rounded-2xl bg-points-gold/20 px-5 py-3 text-center"
          >
            <p className="font-heading text-lg font-bold" style={{ color: '#FFC107' }}>
              🔥 3-in-a-row! Bonus +5 pts!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Halfway celebration */}
      <AnimatePresence>
        {showHalfway && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="rounded-2xl bg-maths/15 px-5 py-3 text-center"
          >
            <p className="font-heading text-lg font-bold text-maths">
              🎯 Halfway there — keep going!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header row: hearts + live score */}
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
          {/* Live score display */}
          <div className="relative flex items-center gap-1">
            <span className="font-heading text-sm font-bold text-ink">
              {questionsCorrect}/{activeQuestions.length}
            </span>
            <AnimatePresence>
              {pointsFlash !== null && (
                <motion.span
                  key={totalPoints}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1 }}
                  className="absolute -top-5 right-0 text-sm font-bold"
                  style={{ color: '#FFC107' }}
                >
                  +{pointsFlash}pts
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-xs text-muted">
              · {totalPoints}pts
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Question {qIndex + 1} of {activeQuestions.length}</span>
        {!questionDone && attempts > 0 && (
          <span className="text-xs font-bold" style={{ color: '#FF6B6B' }}>
            {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left
          </span>
        )}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <motion.div
          className="h-full rounded-full bg-maths"
          animate={{ width: `${(qIndex / activeQuestions.length) * 100}%` }}
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
          {showWorkedExample && q.worked_example && (
            <WorkedExample example={q.worked_example} />
          )}

          {/* Bonus challenge badge */}
          {isBonusQuestion && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: '#FFF3CD', color: '#B8860B' }}
            >
              ⭐ Bonus Challenge — double points!
            </motion.div>
          )}

          <p className="mb-5 font-heading text-xl font-bold leading-snug text-ink">
            {q.question_text}
          </p>

          {/* Hints — shown automatically after wrong attempts */}
          {revealedHints.length > 0 && (
            <div className="mb-4 space-y-2">
              {revealedHints.map((hint, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-black/8 bg-yellow-50 px-4 py-3 text-sm text-ink"
                >
                  <span className="mr-2 font-bold text-yellow-600">💡 Hint {i + 1}:</span>
                  {hint}
                </motion.div>
              ))}
            </div>
          )}

          {/* Manual hint button — only before first attempt */}
          {attempts === 0 && !questionDone && (
            <HintButton
              hints={hints}
              revealed={revealedHints}
              onReveal={() => setHintsRevealed((n) => Math.min(n + 1, hints.length))}
              disabled={false}
              countdown={null}
            />
          )}

          {/* Wrong-answer nudge */}
          <AnimatePresence>
            {attempts > 0 && !questionDone && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-sm font-bold"
                style={{ color: '#FF6B6B' }}
              >
                Not quite — here&apos;s a hint. Try again!
              </motion.p>
            )}
          </AnimatePresence>

          {/* Answer choices */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {choices.map((choice) => {
              let cls =
                'min-h-[56px] rounded-xl border-2 px-4 py-3 text-center font-heading font-bold text-ink transition-colors'
              if (!questionDone) {
                // Shade the last wrong pick while still active
                if (choice === lastPicked && attempts > 0) {
                  cls += ' border-incorrect bg-incorrect/20 text-incorrect'
                } else {
                  cls += ' border-black/10 bg-background hover:border-maths hover:bg-maths/10'
                }
              } else if (choice === q.correct_answer) {
                cls += ' border-correct bg-correct/20 text-correct'
              } else if (choice === lastPicked && !answeredCorrectly) {
                cls += ' border-incorrect bg-incorrect/20 text-incorrect'
              } else {
                cls += ' border-black/10 bg-background opacity-50'
              }
              return (
                <motion.button
                  key={choice}
                  onClick={() => pick(choice)}
                  disabled={questionDone}
                  whileTap={questionDone ? {} : { scale: 0.97 }}
                  className={cls}
                >
                  {choice}
                </motion.button>
              )
            })}
          </div>

          {/* Post-question feedback */}
          <AnimatePresence>
            {questionDone && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-4 rounded-xl p-4 ${
                  answeredCorrectly ? 'bg-correct/10' : 'bg-incorrect/10'
                }`}
              >
                <p
                  className="font-bold"
                  style={{ color: answeredCorrectly ? '#40C057' : '#FF6B6B' }}
                >
                  {answeredCorrectly
                    ? attempts === 0
                      ? isBonusQuestion ? '✓ Correct! Double points! ⭐' : '✓ Correct! Full marks!'
                      : `✓ Got it on attempt ${attempts + 1}!`
                    : `✗ The answer is ${q.correct_answer}`}
                </p>
                {isExhausted && (
                  <p className="mt-0.5 text-xs text-muted">No points this time — you&apos;ll get it next time!</p>
                )}
                {q.explanation && (
                  <p className="mt-1 text-sm text-muted">{q.explanation}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {questionDone && !heartsDead && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-1">
              <button
                onClick={next}
                className="min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
              >
                {qIndex + 1 < activeQuestions.length ? 'Next Question →' : 'See Results'}
              </button>
              <ReportProblemButton questionId={q.id} />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
