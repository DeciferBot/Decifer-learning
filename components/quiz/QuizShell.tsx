'use client'

import { useEffect, useRef, useState } from 'react'
import { submitAnswer } from '@/lib/offline'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { HintButton } from './HintButton'
import { TrueFalseGrid, type TrueFalseStatement } from './TrueFalseGrid'
import { OrderedList, type OrderedListItem } from './OrderedList'
import SourceAnalysis, { type SourceAnalysisSubQ } from './SourceAnalysis'
import ExplainExample, { type ExplainExamplePart } from './ExplainExample'
import StructuredAnswer, { type MarkingCriterion } from './StructuredAnswer'
import { HeartsDisplay } from './HeartsDisplay'
import { CardReveal } from '@/components/cards/CardReveal'
import { BadgePopup } from '@/components/quiz/BadgePopup'
import { ReportProblemButton } from './ReportProblemButton'
import { WorkedExample } from './WorkedExample'
import { ReflectionPrompt } from './ReflectionPrompt'
import type { DroppedCard, EarnedBadge } from '@/app/api/quiz/submit/route'
import { DifficultyPicker, type DifficultyChoice } from './DifficultyPicker'
import MathText from '@/components/ui/MathText'
import { GuardianVictoryScreen } from './GuardianVictoryScreen'
import { HeartCrack, Swords, Sparkles, Trophy, Star, RefreshCw, Gift, Flame, Shield, Lightbulb, Target, Check } from '@/components/ui/icons'

// Points awarded per attempt number (1-indexed). Exhausting all attempts = 0.
const POINTS_BY_ATTEMPT = [3, 2, 1] as const
// These types render their own per-item feedback — QuizShell skips the raw correct_answer header.
const MULTIPART_QTYPES = new Set(['true_false_grid', 'ordered_list', 'source_analysis', 'explain_example', 'structured_answer'])
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
  technique_type: string | null
  technique_hint: string | null
  technique_note: string | null
  answer_parts: unknown   // TrueFalseStatement[] | OrderedListItem[] | SourceAnalysisSubQ[] | ExplainExamplePart[] | MarkingCriterion[] | null
  // Source analysis fields (Sprint 4)
  source_text: string | null
  source_label: string | null
  source_type: string | null
  foundation_images: { url: string; alt?: string }[] | null
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
  isFirstWin: boolean
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
  isGuardian = false,
  zoneName = '',
}: {
  questions: QuizQuestion[]
  topicId: string | null
  topicTitle?: string
  initialShields?: number
  submitUrl?: string
  backHref?: string
  backLabel?: string
  winMessage?: string
  isGuardian?: boolean
  zoneName?: string
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
  const [manualHintsRevealed, setManualHintsRevealed] = useState(0)

  // Running score (points, not questions correct)
  const [totalPoints, setTotalPoints] = useState(0)
  const [questionsCorrect, setQuestionsCorrect] = useState(0)
  const [pointsFlash, setPointsFlash] = useState<number | null>(null)

  // Technique score: non-recall questions answered correctly on first attempt
  const [techniqueCorrect, setTechniqueCorrect] = useState(0)
  const [techniqueTotal, setTechniqueTotal] = useState(0)

  // Challenge milestones
  const [bonusIndex, setBonusIndex] = useState(-1)         // which question is the bonus challenge
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

  // Review previous question overlay
  const [showingPrevReview, setShowingPrevReview] = useState(false)

  // Refs
  const answerLogRef = useRef<AnswerLog[]>([])
  const questionStartRef = useRef(Date.now())
  const quizStartRef = useRef(Date.now())
  const heartsAtDoneRef = useRef(MAX_HEARTS)

  const q = activeQuestions[qIndex] ?? activeQuestions[0] ?? questions[0]
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
      hintNumber: manualHintsRevealed,
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

      // Technique tracking: count non-recall questions and first-attempt wins
      const tType = q.technique_type
      if (tType && tType !== 'recall') {
        setTechniqueTotal((n) => n + 1)
        if (attempts === 0) setTechniqueCorrect((n) => n + 1)
      }
      setTimeout(() => setPointsFlash(null), 1200)
      setAnsweredCorrectly(true)
      setQuestionDone(true)

      // Hintless streak tracking
      if (manualHintsRevealed === 0) {
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

  // Called by multipart components when child submits.
  // No retry for these types — one submission, immediate result.
  // childAnswer is optional: structured_answer passes the essay text; others pass nothing.
  function handleMultiPartAnswer({
    allCorrect,
    correctCount,
    totalCount,
    childAnswer,
  }: {
    allCorrect: boolean
    correctCount?: number
    totalCount?: number
    childAnswer?: string
  }) {
    const timeSeconds = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000))
    // Points: full (3) for all correct, partial based on fraction; 2× for bonus challenge
    const fraction = totalCount ? (correctCount ?? 0) / totalCount : (allCorrect ? 1 : 0)
    const isBonus = qIndex === bonusIndex
    const basePts = allCorrect ? POINTS_BY_ATTEMPT[0] : Math.round(fraction * POINTS_BY_ATTEMPT[2])
    const pts = isBonus ? basePts * 2 : basePts
    if (pts > 0) {
      setTotalPoints((p) => p + pts)
      setPointsFlash(pts)
      setTimeout(() => setPointsFlash(null), 1200)
    }
    if (allCorrect) setQuestionsCorrect((n) => n + 1)
    setAnsweredCorrectly(allCorrect)
    setQuestionDone(true)

    // Technique tracking
    const tType = q.technique_type
    if (tType && tType !== 'recall') {
      setTechniqueTotal((n) => n + 1)
      if (allCorrect) setTechniqueCorrect((n) => n + 1)
    }

    answerLogRef.current.push({
      questionId: q.id,
      childAnswer: childAnswer ?? (allCorrect ? 'correct' : 'incorrect'),
      wasCorrect: allCorrect,
      hintNumber: manualHintsRevealed,
      timeSeconds,
    })
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
    setManualHintsRevealed(0)
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
    setManualHintsRevealed(0)
    setTotalPoints(0)
    setQuestionsCorrect(0)
    setPointsFlash(null)
    setTechniqueCorrect(0)
    setTechniqueTotal(0)
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
        <div className="flex justify-center mb-3"><HeartCrack className="w-12 h-12 text-incorrect" aria-hidden /></div>
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

  // ── Guardian victory screen ───────────────────────────────────────────────
  if (done && isGuardian) {
    const passed = Math.round((questionsCorrect / activeQuestions.length) * 100) >= 70
    if (passed && submitResult) {
      return (
        <GuardianVictoryScreen
          zoneName={zoneName}
          score={questionsCorrect}
          total={activeQuestions.length}
          points={submitResult.points ?? 0}
          totalPoints={submitResult.totalPoints ?? 0}
          streakDays={submitResult.streakDays ?? 0}
          droppedCard={submitResult.droppedCard ?? null}
          newBadges={submitResult.newBadges ?? []}
          backHref={backHref}
        />
      )
    }
    if (passed && submitting) {
      return (
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
          <div className="flex justify-center mb-3"><Swords className="w-12 h-12 text-maths" aria-hidden /></div>
          <h2 className="font-heading text-2xl font-bold text-ink">Guardian Defeated!</h2>
          <p className="mt-4 text-sm text-muted">Saving results…</p>
        </div>
      )
    }
  }

  // ── Quiz done → result screen ─────────────────────────────────────────────
  if (done) {
    const pct = Math.round((questionsCorrect / activeQuestions.length) * 100)
    const passed = pct >= 70
    const serverPoints = submitResult?.points
    const serverTotalPoints = submitResult?.totalPoints
    const streakDays = submitResult?.streakDays
    const shieldAwarded = submitResult?.shieldAwarded
    const isFirstWin = submitResult?.isFirstWin === true

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

        {/* ── First-win celebration banner ── */}
        {isFirstWin && passed && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 overflow-hidden rounded-2xl border-2 border-maths bg-gradient-to-br from-maths/10 to-science/10 p-5 text-center"
          >
            <div className="flex justify-center mb-1"><Sparkles className="w-8 h-8 text-maths" aria-hidden /></div>
            <p className="mt-1 font-heading text-lg font-bold text-ink">You completed your first topic!</p>
            <p className="mt-1 text-sm text-muted">
              You&apos;ve earned your first Discovery Card. Keep going — the world map is waiting!
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
        >
          <div className="flex justify-center mb-3">
            {passed ? (isFirstWin ? <Trophy className="w-12 h-12 text-points-gold" aria-hidden /> : <Star className="w-12 h-12 text-points-gold" aria-hidden />) : <RefreshCw className="w-12 h-12 text-muted" aria-hidden />}
          </div>
          <h2 className="font-heading text-2xl font-bold text-ink">
            {passed ? (isFirstWin ? 'First topic complete!' : 'Great work!') : 'Keep going!'}
          </h2>
          <p className={`mt-2 text-4xl font-bold ${passed ? 'text-correct-700' : 'text-ink'}`}>
            {questionsCorrect} / {activeQuestions.length}
          </p>
          <p className="mt-1 text-muted">
            {pct}% — {passed ? winMessage : 'Try again to improve your score.'}
          </p>

          {/* Technique score — only shown when quiz had non-recall questions */}
          {techniqueTotal > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-maths/10 px-4 py-1.5 text-sm font-semibold text-maths">
              <Target className="w-3.5 h-3.5 flex-none" aria-hidden />
              Exam technique: {techniqueCorrect}/{techniqueTotal} question{techniqueTotal !== 1 ? 's' : ''} answered in the right format
            </div>
          )}

          {submitting ? (
            <div className="mt-4 space-y-2 text-center">
              {passed ? (
                <>
                  <div className="flex justify-center animate-pulse"><Gift className="w-8 h-8 text-points-gold" aria-hidden /></div>
                  <p className="text-sm font-bold text-points-gold-700">Opening your Discovery Card…</p>
                </>
              ) : (
                <p className="text-sm text-muted">Saving results…</p>
              )}
            </div>
          ) : submittedOffline ? (
            <p className="mt-4 text-sm text-muted">
              Saved offline — your points will sync when you reconnect.
            </p>
          ) : (
            <div className="mt-4 space-y-1">
              {typeof serverPoints === 'number' && (
                <p className="font-heading font-bold text-points-gold-700">
                  +{serverPoints} points earned
                </p>
              )}
              {typeof serverTotalPoints === 'number' && (
                <p className="text-sm text-muted">Total: {serverTotalPoints.toLocaleString()} pts</p>
              )}
              {typeof streakDays === 'number' && streakDays > 0 && (
                <p className="text-sm text-muted flex items-center gap-1"><Flame className="w-3.5 h-3.5" aria-hidden /> {streakDays} day streak</p>
              )}
              {shieldAwarded && (
                <p className="text-sm font-bold flex items-center gap-1 text-ink-2">
                  <Shield className="w-3.5 h-3.5 text-explorer" aria-hidden /> Streak Shield awarded!
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

  // Previous question review overlay
  if (showingPrevReview && qIndex > 0) {
    const prevQ = activeQuestions[qIndex - 1]
    const prevLogs = answerLogRef.current.filter((l) => l.questionId === prevQ.id)
    const lastLog = prevLogs[prevLogs.length - 1]
    const prevCorrect = lastLog?.wasCorrect ?? false
    const prevAnswer = lastLog?.childAnswer ?? null
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowingPrevReview(false)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-black/5"
          >
            ← Back to quiz
          </button>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Previous question</p>
        <div className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm space-y-4">
          <p className="font-heading text-xl font-bold leading-snug text-ink">
            <MathText text={prevQ.question_text} />
          </p>
          {prevAnswer && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${prevCorrect ? 'bg-correct/10 text-correct' : 'bg-incorrect/10 text-incorrect'}`}>
              {prevCorrect ? '✓ You answered:' : '✗ You answered:'} <MathText text={prevAnswer} />
            </div>
          )}
          {!prevCorrect && (
            <div className="rounded-xl bg-correct/10 px-4 py-3 text-sm text-correct font-semibold">
              Correct answer: <MathText text={prevQ.correct_answer} />
            </div>
          )}
          {prevQ.explanation && (
            <div className="rounded-xl bg-black/3 px-4 py-3 text-sm text-muted">
              <span className="font-bold text-ink">Explanation: </span>
              {prevQ.explanation}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowingPrevReview(false)}
          className="min-h-[48px] w-full rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white transition-opacity hover:opacity-90"
        >
          Continue quiz →
        </button>
      </div>
    )
  }

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
            <p className="font-heading text-lg font-bold flex items-center justify-center gap-1.5 text-points-gold-700">
              <Flame className="w-5 h-5" aria-hidden /> 3-in-a-row! Bonus +5 pts!
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
            <p className="font-heading text-lg font-bold text-maths flex items-center justify-center gap-1.5">
              <Target className="w-5 h-5" aria-hidden /> Halfway there — keep going!
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
              className="flex items-center gap-0.5 text-sm font-bold text-ink-2"
              title="Streak Shields — absorb 1 heart loss each"
            >
              <Shield className="w-4 h-4 text-explorer" aria-hidden /> ×{shields}
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
                  className="absolute -top-5 right-0 text-sm font-bold text-points-gold-700"
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
        <div className="flex items-center gap-2">
          <span>Question {qIndex + 1} of {activeQuestions.length}</span>
          {qIndex > 0 && (
            <button
              onClick={() => setShowingPrevReview(true)}
              className="-my-3 inline-flex min-h-[48px] items-center gap-1 rounded-lg px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              title="Review previous question"
            >
              ← prev
            </button>
          )}
        </div>
        {!questionDone && attempts > 0 && (
          <span className="text-xs font-bold text-points-gold-700">
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
              className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-lightning/25 px-3 py-1 text-xs font-bold text-points-gold-700"
            >
              <Star className="w-3.5 h-3.5" aria-hidden /> Bonus Challenge — double points!
            </motion.div>
          )}

          <p className="mb-5 font-heading text-xl font-bold leading-snug text-ink">
            <MathText text={q.question_text} />
          </p>

          {/* Foundation images — diagrams, graphs, charts referenced in question */}
          {q.foundation_images && q.foundation_images.length > 0 && (
            <div className="mb-5 flex flex-col gap-3">
              {q.foundation_images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.alt ?? 'Question diagram'}
                  className="w-full rounded-xl border border-black/8 object-contain"
                  style={{ maxHeight: 280 }}
                />
              ))}
            </div>
          )}

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
                  <span className="mr-2 font-bold text-yellow-600 inline-flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" aria-hidden /> Hint {i + 1}:</span>
                  <MathText text={hint} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Manual hint button — only before first attempt */}
          {attempts === 0 && !questionDone && (
            <HintButton
              hints={hints}
              revealed={revealedHints}
              onReveal={() => { setHintsRevealed((n) => Math.min(n + 1, hints.length)); setManualHintsRevealed((n) => n + 1) }}
              disabled={false}
              countdown={null}
            />
          )}

          {/* Technique hint — shown on first wrong attempt if question has a non-recall technique */}
          <AnimatePresence>
            {attempts === 1 && !questionDone && q.technique_hint && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 rounded-xl border border-maths/30 bg-maths/10 px-4 py-3 text-sm text-ink"
              >
                <span className="mr-1.5 font-bold text-maths inline-flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" aria-hidden /> How to answer:
                </span>
                {q.technique_hint}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wrong-answer nudge */}
          <AnimatePresence>
            {attempts > 0 && !questionDone && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-sm font-bold text-rose-700"
              >
                {attempts === 1 && q.technique_hint
                  ? "Not quite — read the tip above and try again!"
                  : "Not quite — here's a hint. Try again!"}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Answer area — dispatched by question_type */}
          {q.question_type === 'true_false_grid' && Array.isArray(q.answer_parts) && (q.answer_parts as TrueFalseStatement[])[0]?.statement !== undefined ? (
            <div className="mt-4">
              <TrueFalseGrid
                statements={q.answer_parts as TrueFalseStatement[]}
                onAnswer={handleMultiPartAnswer}
                disabled={questionDone}
              />
            </div>
          ) : q.question_type === 'ordered_list' && Array.isArray(q.answer_parts) && (q.answer_parts as OrderedListItem[])[0]?.item !== undefined ? (
            <div className="mt-4">
              <OrderedList
                items={q.answer_parts as OrderedListItem[]}
                onAnswer={handleMultiPartAnswer}
                disabled={questionDone}
              />
            </div>
          ) : q.question_type === 'source_analysis' && Array.isArray(q.answer_parts) && q.source_text ? (
            <div className="mt-4">
              <SourceAnalysis
                sourceText={q.source_text}
                sourceLabel={q.source_label ?? 'Source'}
                sourceType={q.source_type ?? 'quote'}
                subQuestions={q.answer_parts as SourceAnalysisSubQ[]}
                onAnswer={handleMultiPartAnswer}
                disabled={questionDone}
              />
            </div>
          ) : q.question_type === 'explain_example' && Array.isArray(q.answer_parts) ? (
            <div className="mt-4">
              <ExplainExample
                parts={q.answer_parts as ExplainExamplePart[]}
                onAnswer={handleMultiPartAnswer}
                disabled={questionDone}
              />
            </div>
          ) : q.question_type === 'structured_answer' && Array.isArray(q.answer_parts) && (q.answer_parts as MarkingCriterion[])[0]?.criterion !== undefined ? (
            <div className="mt-4">
              <StructuredAnswer
                criteria={q.answer_parts as MarkingCriterion[]}
                questionId={q.id}
                onAnswer={handleMultiPartAnswer}
                disabled={questionDone}
              />
            </div>
          ) : (
            /* Default: MCQ choice buttons */
            <div className="mt-4 grid grid-cols-2 gap-3">
              {choices.map((choice) => {
                let cls =
                  'min-h-[56px] rounded-xl border-2 px-4 py-3 text-center font-heading font-bold text-ink transition-colors'
                if (!questionDone) {
                  if (choice === lastPicked && attempts > 0) {
                    cls += ' border-incorrect bg-incorrect/20 text-rose-700'
                  } else {
                    cls += ' border-black/10 bg-background hover:border-maths hover:bg-maths/10'
                  }
                } else if (choice === q.correct_answer) {
                  cls += ' border-correct bg-correct/20 text-correct-700'
                } else if (choice === lastPicked && !answeredCorrectly) {
                  cls += ' border-incorrect bg-incorrect/20 text-rose-700'
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
                    <MathText text={choice} />
                  </motion.button>
                )
              })}
            </div>
          )}

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
                {/* Multipart types render their own feedback — only show explanation/technique here */}
                {!MULTIPART_QTYPES.has(q.question_type) && (
                  <p className={`font-bold ${answeredCorrectly ? 'text-correct-700' : 'text-rose-700'}`}>
                    {answeredCorrectly
                      ? attempts === 0
                        ? isBonusQuestion
                          ? <span className="flex items-center gap-1"><Check className="w-4 h-4" aria-hidden /> Correct! Double points! <Star className="w-4 h-4" aria-hidden /></span>
                          : <span className="flex items-center gap-1"><Check className="w-4 h-4" aria-hidden /> Correct! Full marks!</span>
                        : <span className="flex items-center gap-1"><Check className="w-4 h-4" aria-hidden /> Got it on attempt {attempts + 1}!</span>
                      : `✗ The answer is ${q.correct_answer}`}
                  </p>
                )}
                {isExhausted && (
                  <p className="mt-0.5 text-xs text-muted">No points this time — you&apos;ll get it next time!</p>
                )}
                {q.explanation && (
                  <p className="mt-1 text-sm text-muted">{q.explanation}</p>
                )}
                {q.technique_note && (
                  <p className="mt-2 text-xs font-semibold text-maths border-t border-maths/20 pt-2">
                    💡 {q.technique_note}
                  </p>
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
