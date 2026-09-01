'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitAnswer } from '@/lib/offline'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { HintButton } from './HintButton'
import { TrueFalseGrid, type TrueFalseStatement } from './TrueFalseGrid'
import { OrderedList, type OrderedListItem } from './OrderedList'
import SourceAnalysis, { type SourceAnalysisSubQ } from './SourceAnalysis'
import ExplainExample, { type ExplainExamplePart } from './ExplainExample'
import StructuredAnswer, { type MarkingCriterion } from './StructuredAnswer'
import { MatchPairs, type MatchPair } from './MatchPairs'
import { TypeAnswer, type AcceptedAnswer } from './TypeAnswer'
import { HeartsDisplay } from './HeartsDisplay'
import { CardReveal } from '@/components/cards/CardReveal'
import { BadgePopup } from '@/components/quiz/BadgePopup'
import { ReportProblemButton } from './ReportProblemButton'
import { WorkedExample } from './WorkedExample'
import { ReflectionPrompt } from './ReflectionPrompt'
import type { DroppedCard, EarnedBadge } from '@/app/api/quiz/submit/route'
import { DifficultyPicker, type DifficultyChoice } from './DifficultyPicker'
import { postQuizEvent, beaconQuizEvent } from './quiz-events'
import { fireFeedback } from '@/lib/feedback'
import { SoundToggle } from './SoundToggle'
import { WinBurst } from './WinBurst'
import MathText from '@/components/ui/MathText'
import { GuardianVictoryScreen } from './GuardianVictoryScreen'
import { HeartCrack, Swords, Sparkles, Trophy, Star, RefreshCw, Gift, Flame, Shield, Lightbulb, Target, Check } from '@/components/ui/icons'
import { StudyBuddy } from './StudyBuddy'
import type { BuddyId } from '@/lib/customise-config'
import {
  type BuddyMood, pickLine,
  CORRECT_FIRST_TRY, CORRECT_WITH_HELP, TRY_AGAIN, COMBO, LAST_QUESTION,
} from '@/lib/buddy-lines'
import { isYoungBand } from '@/lib/quiz/young-mode'
import { QuestionListenButton } from './QuestionListenButton'

// Points awarded per attempt number (1-indexed). Exhausting all attempts = 0.
const POINTS_BY_ATTEMPT = [3, 2, 1] as const
// These types render their own per-item feedback — QuizShell skips the raw correct_answer header.
const MULTIPART_QTYPES = new Set(['true_false_grid', 'ordered_list', 'source_analysis', 'explain_example', 'structured_answer', 'match_pairs'])
const MAX_ATTEMPTS = 3
const MAX_HEARTS = 3
// Hearts are lost when a question is fully exhausted (all attempts wrong),
// not on individual wrong answers. 3 exhausted questions = 1 heart lost.
//
// Hearts now apply to Zone Guardian battles only. Across the 99 topic-quiz
// attempts on record not one ever ran out of them, so on an ordinary quiz they
// were pure threat with no stake: they cost header room on a 375 px screen and
// bought nothing. A boss fight is where losing is supposed to be possible.
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
  // KS1 visual-answer mode — { [answerText]: imageUrl }. See schema.prisma.
  option_images: Record<string, string> | null
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
  /** Count of questions answered correctly (a fraction from /api/quiz/checkpoint). */
  score: number
  /** Credit-weighted 0–1 score the pass decision was made on. */
  scoreFraction?: number
  totalQuestions: number
  totalPoints: number
  streakDays: number
  newStreak: boolean
  droppedCard: DroppedCard | null
  newBadges: EarnedBadge[]
  shieldAwarded: boolean
  /** True when a freeze was spent to keep a streak that would have reset. */
  streakSaved?: boolean
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
  submitUrl = '/api/quiz/submit',
  backHref = '/dashboard/child',
  backLabel = 'Back',
  winMessage = 'Topic complete!',
  isGuardian = false,
  zoneName = '',
  nextTopic = null,
  preselected = false,
  yearGroupLabel = null,
}: {
  questions: QuizQuestion[]
  topicId: string | null
  topicTitle?: string
  submitUrl?: string
  backHref?: string
  backLabel?: string
  winMessage?: string
  isGuardian?: boolean
  zoneName?: string
  /**
   * Drives the "young mode" presentation: bigger type and tap targets, a
   * read-aloud button, picture answer cards where the question has them, and
   * a guardrail retry. Optional and additive — omit it and every caller gets
   * today's behaviour unchanged. See lib/quiz/young-mode.ts.
   */
  yearGroupLabel?: string | null
  // The next topic in this zone — drives the "Continue" CTA and the unlock
  // celebration on a passing result. newlyUnlocked = the child hasn't completed
  // it yet (i.e. this pass just opened it up).
  nextTopic?: { id: string; title: string; newlyUnlocked: boolean } | null
  /**
   * True when the server already pitched this quiz for the child (their first
   * attempt on the topic). Skips the difficulty picker and keeps the questions
   * in the deliberate easiest-first order the server chose, instead of asking a
   * child who has never seen the topic to judge their own difficulty and then
   * shuffling that judgement away.
   */
  preselected?: boolean
}) {
  const router = useRouter()

  // Hearts are a boss-fight mechanic only. See EXHAUSTED_FOR_HEART_LOSS above.
  const heartsEnabled = isGuardian
  const youngMode = isYoungBand(yearGroupLabel)

  // Difficulty selection — shown before quiz starts, unless preselected
  const [difficulty, setDifficulty] = useState<DifficultyChoice | null>(
    preselected ? 'confidence' : null,
  )

  // Shuffled + filtered question list — set when child picks difficulty.
  // When preselected, the server order is kept exactly as delivered.
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>(
    preselected ? questions : [],
  )

  const [qIndex, setQIndex] = useState(0)
  const [choices, setChoices] = useState<string[]>(() => buildInitialChoices(questions[0]))

  // Per-question attempt state
  const [attempts, setAttempts] = useState(0)          // wrong attempts on current question
  const [lastPicked, setLastPicked] = useState<string | null>(null)
  const [questionDone, setQuestionDone] = useState(false)   // answered correctly OR exhausted
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false)
  const [hintsRevealed, setHintsRevealed] = useState(0)
  const [manualHintsRevealed, setManualHintsRevealed] = useState(0)
  // Guardrail retry (young mode only): a wrong pick is disabled rather than
  // staying clickable, so a second guess is narrower, never harder. Reset
  // alongside the other per-question state in next()/startFixUp().
  const [ruledOut, setRuledOut] = useState<Set<string>>(new Set())

  // Running score (points, not questions correct)
  const [totalPoints, setTotalPoints] = useState(0)
  const [questionsCorrect, setQuestionsCorrect] = useState(0)
  const [pointsFlash, setPointsFlash] = useState<number | null>(null)

  // Technique score: non-recall questions answered correctly on first attempt
  const [techniqueCorrect, setTechniqueCorrect] = useState(0)
  const [techniqueTotal, setTechniqueTotal] = useState(0)

  // Challenge milestones
  const [bonusIndex, setBonusIndex] = useState(preselected ? pickBonusIndex(questions.length) : -1)
  const [hintlessStreak, setHintlessStreak] = useState(0)  // correct answers with no hints used
  const [showStreakBonus, setShowStreakBonus] = useState(false)
  const [showHalfway, setShowHalfway] = useState(false)

  // Hearts + streak shields
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [exhaustedQuestions, setExhaustedQuestions] = useState(0)
  const [heartsDead, setHeartsDead] = useState(false)

  // Worked examples — shown on the first question of each question_type in the session.
  const shownWorkedExampleFor = useRef<Set<string>>(new Set())

  // Fix-up round: after a miss, the child replays only the questions they did
  // not get right, rather than being shown a fail screen and asked to redo the
  // whole round. The replay submits as its own attempt, so clearing it is what
  // completes the topic.
  const [isFixUp, setIsFixUp] = useState(false)

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

  // Study buddy — the character picked in Customise, reacting through the
  // quiz. buddyId stays null (buddy renders nothing) for a child who hasn't
  // picked one; this is a companion layered on top, never a requirement.
  const [buddyId, setBuddyId] = useState<BuddyId | null>(null)
  const [buddyMood, setBuddyMood] = useState<BuddyMood>('idle')
  const [buddyLine, setBuddyLine] = useState<string | null>(null)
  const buddyLineTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profile?: { studyBuddy?: string | null } } | null) => {
        if (cancelled) return
        const buddy = data?.profile?.studyBuddy
        if (buddy) setBuddyId(buddy as BuddyId)
      })
      .catch(() => {
        // No buddy today is a silent no-op, never a broken quiz.
      })
    return () => { cancelled = true }
  }, [])

  /** Set the buddy's mood and speech; the line fades on its own after a beat. */
  function sayBuddy(mood: BuddyMood, pool: readonly string[]) {
    if (buddyLineTimeoutRef.current) clearTimeout(buddyLineTimeoutRef.current)
    setBuddyMood(mood)
    setBuddyLine(pickLine(pool, buddyLine ?? undefined))
    buddyLineTimeoutRef.current = setTimeout(() => setBuddyLine(null), 3200)
  }

  // Refs
  const answerLogRef = useRef<AnswerLog[]>([])
  const questionStartRef = useRef(Date.now())
  const quizStartRef = useRef(Date.now())
  const heartsAtDoneRef = useRef(MAX_HEARTS)
  // Accessibility: ref to the feedback region so focus can be moved there after answering
  const feedbackRef = useRef<HTMLDivElement>(null)

  const q = activeQuestions[qIndex] ?? activeQuestions[0] ?? questions[0]
  const hints = [q.hint_1, q.hint_2, q.hint_3].filter((h): h is string => h !== null)
  const revealedHints = hints.slice(0, hintsRevealed)

  // ── Drop-point instrumentation ───────────────────────────────────────────
  // quiz_started fires on page mount, so it counts reloads and picker views and
  // cannot say where a child stops. These two can: quiz_first_answer when the
  // child answers anything at all, quiz_abandoned when they leave before the
  // quiz is submitted, carrying the question they were on.
  const firstAnswerFiredRef = useRef(false)
  const abandonFiredRef = useRef(false)
  const progressRef = useRef({
    stage: 'picker' as 'picker' | 'in_quiz',
    questionIndex: 0,
    totalQuestions: 0,
    answered: 0,
    difficulty: 'none',
    hearts: MAX_HEARTS,
    finished: false,
  })

  useEffect(() => {
    progressRef.current = {
      stage: difficulty === null ? 'picker' : 'in_quiz',
      questionIndex: qIndex,
      totalQuestions: activeQuestions.length,
      answered: new Set(answerLogRef.current.map((l) => l.questionId)).size,
      difficulty: difficulty ?? 'none',
      hearts,
      // Once the quiz is submitted there is nothing left to abandon.
      finished: done,
    }
  })

  function recordFirstAnswer() {
    if (firstAnswerFiredRef.current) return
    firstAnswerFiredRef.current = true
    void postQuizEvent({
      eventType: 'quiz_first_answer',
      topicId,
      metadata: {
        difficulty: difficulty ?? 'none',
        total_questions: activeQuestions.length,
        is_guardian: isGuardian,
      },
    })
  }

  useEffect(() => {
    // A child who backgrounds the app and never returns looks identical to one
    // who navigates away, and on iOS Safari `pagehide` often does not fire for
    // the former. So we treat "hidden" as gone, and clear the guard if they come
    // back, which can produce more than one abandon event per session. Analysis
    // should take the last event per profile+topic rather than counting them.
    function fireAbandon(reason: 'pagehide' | 'hidden' | 'navigated_away') {
      if (abandonFiredRef.current) return
      const p = progressRef.current
      if (p.finished) return
      abandonFiredRef.current = true
      beaconQuizEvent({
        eventType: 'quiz_abandoned',
        topicId,
        metadata: {
          reason,
          stage: p.stage,
          question_index: p.questionIndex,
          total_questions: p.totalQuestions,
          questions_answered: p.answered,
          difficulty: p.difficulty,
          hearts_remaining: p.hearts,
          is_guardian: isGuardian,
        },
      })
    }

    function onPageHide() { fireAbandon('pagehide') }
    function onVisibility() {
      if (document.visibilityState === 'hidden') fireAbandon('hidden')
      else abandonFiredRef.current = false
    }

    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      fireAbandon('navigated_away')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, isGuardian])

  const showWorkedExample =
    !questionDone &&
    attempts === 0 &&
    !!q.worked_example &&
    !shownWorkedExampleFor.current.has(q.question_type)

  /**
   * One try at a single-answer question.
   *
   * `choice` is normally one of the four buttons, and matching the stored answer
   * exactly is the whole test. A typed answer is different: the child may write
   * "twelve" where we hold "12", and Oak tells us every spelling that counts. So
   * TypeAnswer does its own comparing and passes the verdict in through
   * `knownCorrect`. Everything after this line — tries, clues, points, the streak,
   * the record of what they answered — is shared, so a typed question behaves
   * exactly like a tapped one.
   */
  function pick(choice: string, knownCorrect?: boolean) {
    if (questionDone) return
    const isCorrect = knownCorrect ?? choice === q.correct_answer
    const timeSeconds = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000))
    const newAttempts = attempts + 1

    recordFirstAnswer()
    setLastPicked(choice)

    answerLogRef.current.push({
      questionId: q.id,
      childAnswer: choice,
      wasCorrect: isCorrect,
      hintNumber: manualHintsRevealed,
      timeSeconds,
    })

    if (isCorrect) {
      fireFeedback('correct')
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
      // Move focus to feedback region so screen readers announce the result
      setTimeout(() => feedbackRef.current?.focus(), 60)

      // Hintless streak tracking
      if (manualHintsRevealed === 0) {
        const newStreak = hintlessStreak + 1
        setHintlessStreak(newStreak)
        if (newStreak === 3) {
          // Streak bonus: +5 pts on top
          fireFeedback('combo')
          setTotalPoints((p) => p + 5)
          setShowStreakBonus(true)
          setTimeout(() => setShowStreakBonus(false), 2000)
          setHintlessStreak(0)
          sayBuddy('excited', COMBO)
        } else {
          sayBuddy('happy', attempts === 0 ? CORRECT_FIRST_TRY : CORRECT_WITH_HELP)
        }
      } else {
        setHintlessStreak(0)
        sayBuddy('happy', CORRECT_WITH_HELP)
      }

      // Halfway celebration
      const midpoint = Math.floor(activeQuestions.length / 2)
      if (qIndex + 1 === midpoint && !showHalfway) {
        setShowHalfway(true)
        setTimeout(() => setShowHalfway(false), 2200)
      }
    } else {
      fireFeedback('incorrect')
      setAttempts(newAttempts)
      setRuledOut((prev) => new Set(prev).add(choice))
      if (newAttempts < MAX_ATTEMPTS) sayBuddy('oops', TRY_AGAIN)
      if (newAttempts >= MAX_ATTEMPTS) {
        // Exhausted all attempts
        setQuestionDone(true)
        setTimeout(() => feedbackRef.current?.focus(), 60)
        if (!heartsEnabled) return
        const newExhausted = exhaustedQuestions + 1
        if (newExhausted >= EXHAUSTED_FOR_HEART_LOSS) {
          // Shields are no longer spent here. They are streak freezes now (see
          // lib/streak.ts), which is what their name always promised; letting a
          // boss fight eat them would take away the thing protecting the streak.
          const newH = hearts - 1
          heartsAtDoneRef.current = newH
          setHearts(newH)
          if (newH <= 0) setHeartsDead(true)
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
    recordFirstAnswer()
    // Points: full (3) for all correct, partial based on fraction; 2× for bonus challenge
    const fraction = totalCount ? (correctCount ?? 0) / totalCount : (allCorrect ? 1 : 0)
    const isBonus = qIndex === bonusIndex
    const basePts = allCorrect ? POINTS_BY_ATTEMPT[0] : Math.round(fraction * POINTS_BY_ATTEMPT[2])
    const pts = isBonus ? basePts * 2 : basePts
    fireFeedback(allCorrect ? 'correct' : 'incorrect')
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
      fireFeedback('roundComplete')
      heartsAtDoneRef.current = hearts
      setDone(true)
      return
    }
    // Anticipation beats the win itself — tell the child before the last
    // question, not just after it.
    if (nextIdx === activeQuestions.length - 1) sayBuddy('anticipation', LAST_QUESTION)
    const nextQ = activeQuestions[nextIdx]
    setChoices(buildInitialChoices(nextQ))
    setQIndex(nextIdx)
    setLastPicked(null)
    setAttempts(0)
    setQuestionDone(false)
    setAnsweredCorrectly(false)
    setHintsRevealed(0)
    setManualHintsRevealed(0)
    setRuledOut(new Set())
    questionStartRef.current = Date.now()
  }

  /** Questions in the round just played that were never answered correctly. */
  function missedQuestions(): QuizQuestion[] {
    const gotRight = new Set(
      answerLogRef.current.filter((l) => l.wasCorrect).map((l) => l.questionId),
    )
    return activeQuestions.filter((qq) => !gotRight.has(qq.id))
  }

  /**
   * Replay only the missed questions. Everything the child already earned is
   * banked by the submit that just happened, so this starts a clean attempt over
   * a smaller set rather than throwing the round away and starting again.
   */
  function startFixUp() {
    const missed = missedQuestions()
    if (missed.length === 0) return

    setIsFixUp(true)
    setActiveQuestions(missed)
    // No bonus question in a fix-up: doubling points on a question the child has
    // already got wrong once reads as a taunt.
    setBonusIndex(-1)
    setQIndex(0)
    setChoices(buildInitialChoices(missed[0]))
    setLastPicked(null)
    setAttempts(0)
    setQuestionDone(false)
    setAnsweredCorrectly(false)
    setHintsRevealed(0)
    setManualHintsRevealed(0)
    setRuledOut(new Set())
    setTotalPoints(0)
    setQuestionsCorrect(0)
    setPointsFlash(null)
    setTechniqueCorrect(0)
    setTechniqueTotal(0)
    setHintlessStreak(0)
    setShowStreakBonus(false)
    setShowHalfway(false)
    setExhaustedQuestions(0)
    setDone(false)
    setSubmitting(false)
    setSubmitResult(null)
    setSubmittedOffline(false)
    setShowCard(false)
    setBadgeQueue([])
    setShowReflection(false)
    shownWorkedExampleFor.current = new Set()
    answerLogRef.current = []
    questionStartRef.current = Date.now()
    quizStartRef.current = Date.now()
    heartsAtDoneRef.current = hearts
    // A fix-up is its own run for drop-point instrumentation.
    firstAnswerFiredRef.current = false
    abandonFiredRef.current = false
  }

  function restart() {
    // A preselected quiz keeps its server-pitched set on an in-page retry. The
    // child gets the full picker next time they open the page, by which point
    // the attempt is recorded and the server serves the standard mix.
    setDifficulty(preselected ? 'confidence' : null)
    setActiveQuestions(preselected ? questions : [])
    setIsFixUp(false)
    setBonusIndex(preselected ? pickBonusIndex(questions.length) : -1)
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
    setRuledOut(new Set())
    setTotalPoints(0)
    setQuestionsCorrect(0)
    setPointsFlash(null)
    setTechniqueCorrect(0)
    setTechniqueTotal(0)
    setDone(false)
    setHeartsDead(false)
    setHearts(MAX_HEARTS)
    setExhaustedQuestions(0)
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
    // A retry is a fresh run: it gets its own first-answer and abandon events.
    firstAnswerFiredRef.current = false
    abandonFiredRef.current = false
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
          // No analytics event here by policy: quizzes are a child activity and
          // children's data is never sent to GA (see lib/analytics.ts scope note).
          if (data.passed && data.droppedCard) setShowCard(true)
          else if (data.newBadges?.length) setBadgeQueue(data.newBadges)
          else if (data.passed) setShowReflection(true)
          // Purge the App Router client cache so back-navigation to the
          // dashboard / world map refetches fresh server data. Without this,
          // soft navigation serves the pre-quiz RSC payload and the home page
          // shows the topic as still incomplete until a hard refresh.
          router.refresh()
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

  // ── Hearts dead → retry screen (boss fights only) ────────────────────────
  if (heartsDead && heartsEnabled) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
      >
        <div className="flex justify-center mb-3"><HeartCrack className="w-12 h-12 text-incorrect-700" aria-hidden /></div>
        <h2 className="font-heading text-2xl font-bold text-ink">Out of hearts!</h2>
        <p className="mt-2 text-muted">Don&apos;t worry, no score saved. Give it another go!</p>
        <button
          onClick={restart}
          className="mt-6 min-h-[48px] w-full rounded-xl bg-brand-600 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-700"
        >
          Try Again
        </button>
      </motion.div>
    )
  }

  // ── Guardian victory screen ───────────────────────────────────────────────
  if (done && isGuardian) {
    // Server first, same as the topic result screen: it is the side that decides
    // whether the Legendary card and the Guardian Slayer badge are awarded, so a
    // victory screen driven by a local count could celebrate a win the server
    // never recorded. The local count is only the estimate shown while the
    // submission is still in flight.
    const passed = submitResult
      ? submitResult.passed
      : Math.round((questionsCorrect / activeQuestions.length) * 100) >= 70
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
          <div className="flex justify-center mb-3"><Swords className="w-12 h-12 text-on-maths" aria-hidden /></div>
          <h2 className="font-heading text-2xl font-bold text-ink">Guardian Defeated!</h2>
          <p className="mt-4 text-sm text-muted">Saving results…</p>
        </div>
      )
    }
  }

  // ── Quiz done → result screen ─────────────────────────────────────────────
  if (done) {
    // The server is the authority: it re-checks every answer against the
    // database and applies the per-attempt credit. It used to be ignored here,
    // and on 37 of the 99 attempts on record the child was shown "Great work!"
    // while the server recorded a fail and withheld the card, the progress and
    // the unlock. Fall back to the local count only while the submission is in
    // flight or the child is offline.
    const localPct = Math.round((questionsCorrect / activeQuestions.length) * 100)
    const passed = submitResult ? submitResult.passed : localPct >= 70
    // How many more questions a first-try correct would have needed to finish.
    // Uses scoreFraction, never `score`: that field is a COUNT from
    // /api/quiz/submit and /api/guardian, and a 0–1 fraction from
    // /api/quiz/checkpoint, so it cannot be read as one thing.
    const scoreFraction = submitResult?.scoreFraction
    const questionsToPass = scoreFraction != null && !passed
      ? Math.max(1, Math.ceil(submitResult!.totalQuestions * (0.7 - scoreFraction)))
      : 0
    const serverPoints = submitResult?.points
    const serverTotalPoints = submitResult?.totalPoints
    const streakDays = submitResult?.streakDays
    const shieldAwarded = submitResult?.shieldAwarded
    const streakSaved = submitResult?.streakSaved === true
    const isFirstWin = submitResult?.isFirstWin === true

    // A miss is a detour, not a verdict: offer the questions they got wrong as a
    // short replay instead of asking them to redo the whole round. Only offered
    // once the submit has landed, so the points and the card are already banked,
    // and never on a Guardian battle, where a loss is meant to end the fight.
    const missedCount = missedQuestions().length
    const canFixUp = !passed && !isGuardian && !!submitResult && missedCount > 0

    // Answered everything correctly in the end, but took enough retries that the
    // credit weighting kept the score under the pass mark. 17 of the 99 attempts
    // on record landed here and every one of them was shown a grey retry icon for
    // getting the whole round right. There is nothing to fix up, so this earns an
    // honest "go again for a cleaner run" rather than a failure screen.
    const allEventuallyCorrect = !passed && !isGuardian && !!submitResult && missedCount === 0

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
            className="mb-4 overflow-hidden rounded-2xl border-2 border-brand bg-gradient-to-br from-maths/10 to-science/10 p-5 text-center"
          >
            <div className="flex justify-center mb-1"><Sparkles className="w-8 h-8 text-on-maths" aria-hidden /></div>
            <p className="mt-1 font-heading text-lg font-bold text-ink">You completed your first topic!</p>
            <p className="mt-1 text-sm text-muted">
              You&apos;ve earned your first Discovery Card. Keep going, the world map is waiting!
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm"
        >
          {/* Confetti for a pass, and for a round that still banked a card. */}
          {(passed || canFixUp || allEventuallyCorrect) && <WinBurst />}
          <div className="relative flex justify-center mb-3">
            {passed
              ? (isFirstWin ? <Trophy className="w-12 h-12 text-points-gold" aria-hidden /> : <Star className="w-12 h-12 text-points-gold" aria-hidden />)
              : canFixUp || allEventuallyCorrect
                // A round that ends with points banked and a card won is not a
                // failure screen, so it does not get the grey retry icon.
                ? <Sparkles className="w-12 h-12 text-points-gold" aria-hidden />
                : <RefreshCw className="w-12 h-12 text-muted" aria-hidden />}
          </div>
          <h2 className="font-heading text-2xl font-bold text-ink">
            {passed
              ? (isFirstWin ? 'First topic complete!' : 'Great work!')
              : allEventuallyCorrect
                ? 'You got every one!'
              : canFixUp
                ? (isFixUp ? 'Nearly there!' : 'Round complete!')
              // "You got 0 right" is a rough thing to say to a child, so a blank
              // result gets encouragement instead of a count.
              : questionsCorrect > 0
                ? `You got ${questionsCorrect} right`
                : 'This one is tricky'}
          </h2>
          <p className={`mt-2 text-4xl font-bold ${passed ? 'text-correct-700' : 'text-ink'}`}>
            {questionsCorrect} / {activeQuestions.length}
          </p>
          {/* A miss leads with the work that counted, not the percentage. Points
              are already banked and the topic is saved as in progress, so the
              child needs to know the effort was not thrown away. */}
          {/* No percentage here on purpose. The count above is what a child can
              act on, and the server score is credit-weighted by how many tries
              each question took, so a percentage beside "8 / 10" would not match
              it. */}
          <p className="mt-1 text-muted">
            {passed
              ? winMessage
              : allEventuallyCorrect
                ? 'Every question, right in the end. A few took more than one go, so play it once more to finish the topic off.'
              : canFixUp
                ? `Your points are banked. ${missedCount} question${missedCount !== 1 ? 's' : ''} gave you trouble, so let's just do ${missedCount !== 1 ? 'those' : 'that one'} again.`
              : questionsToPass > 0
                ? `${questionsToPass} more and this topic is finished. Your points are saved and we have kept your progress.`
                : 'Your points are saved and we have kept your progress. Have another go when you are ready.'}
          </p>

          {/* Technique score — only shown when quiz had non-recall questions */}
          {techniqueTotal > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-sm font-semibold text-on-maths">
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
              Saved offline. Your points will sync when you reconnect.
            </p>
          ) : (
            <div className="mt-4 space-y-1">
              {typeof serverPoints === 'number' && (
                <p className="font-heading font-bold text-points-gold-700">
                  +{serverPoints} points earned
                </p>
              )}
              {typeof serverTotalPoints === 'number' && (
                <p className="text-sm text-muted">Total: {serverTotalPoints.toLocaleString()} points</p>
              )}
              {typeof streakDays === 'number' && streakDays > 0 && (
                <p className="text-sm text-muted flex items-center gap-1"><Flame className="w-3.5 h-3.5" aria-hidden /> {streakDays} day streak</p>
              )}
              {streakSaved && (
                <p className="text-sm font-bold flex items-center justify-center gap-1 text-ink-2">
                  <Shield className="w-3.5 h-3.5 text-explorer" aria-hidden /> A Streak Shield saved your streak!
                </p>
              )}
              {shieldAwarded && (
                <p className="text-sm font-bold flex items-center justify-center gap-1 text-ink-2">
                  <Shield className="w-3.5 h-3.5 text-explorer" aria-hidden /> Streak Shield earned. It protects your streak if you miss a day.
                </p>
              )}
            </div>
          )}

          {/* Unlock celebration — only when this pass opens a new topic */}
          {passed && nextTopic?.newlyUnlocked && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-science/15 px-4 py-1.5 text-sm font-bold text-on-science"
            >
              <Sparkles className="w-4 h-4 flex-none" aria-hidden /> New topic unlocked!
            </motion.div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {/* Primary forward path — continue the adventure, never a dead-end */}
            {passed && nextTopic && (
              <Link
                href={`/topics/${nextTopic.id}/learn`}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-700"
              >
                {nextTopic.newlyUnlocked ? 'Start' : 'Next'}: {nextTopic.title} →
              </Link>
            )}
            {passed && !nextTopic && (
              <Link
                href="/world-map"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-700"
              >
                See your World Map →
              </Link>
            )}
            {passed && (
              <Link
                href="/collection"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-black/10 px-6 py-3 font-heading font-bold text-on-maths transition-colors hover:bg-brand/10"
              >
                View Collection
              </Link>
            )}
            {canFixUp && (
              <button
                onClick={startFixUp}
                className="min-h-[48px] rounded-xl bg-brand-600 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-700"
              >
                Fix {missedCount === 1 ? 'that one' : `those ${missedCount}`} →
              </button>
            )}
            {!passed && !canFixUp && (
              <button
                onClick={restart}
                className="min-h-[48px] rounded-xl bg-brand-600 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-700"
              >
                {allEventuallyCorrect ? 'Go again for a clean run →' : 'Try Again'}
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
            className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${prevCorrect ? 'bg-correct/10 text-correct-700' : 'bg-incorrect/10 text-incorrect-700'}`}>
              {/* aria-hidden the symbol; the surrounding text is sufficient */}
              <span aria-hidden>{prevCorrect ? '✓' : '✗'}</span>
              {prevCorrect ? ' You answered: ' : ' Your answer: '}
              <MathText text={prevAnswer} />
            </div>
          )}
          {!prevCorrect && (
            <div className="rounded-xl bg-correct/10 px-4 py-3 text-sm text-correct-700 font-semibold">
              Correct answer: <MathText text={prevQ.correct_answer} />
            </div>
          )}
          {prevQ.explanation && (
            <div className="rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-muted">
              <span className="font-bold text-ink">Explanation: </span>
              <MathText text={prevQ.explanation} />
            </div>
          )}
        </div>
        <button
          onClick={() => setShowingPrevReview(false)}
          className="min-h-[48px] w-full rounded-xl bg-brand-600 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
              <Flame className="w-5 h-5" aria-hidden /> 3-in-a-row! Bonus +5 points!
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
            className="rounded-2xl bg-brand/15 px-5 py-3 text-center"
          >
            <p className="font-heading text-lg font-bold text-on-maths flex items-center justify-center gap-1.5">
              <Target className="w-5 h-5" aria-hidden /> Halfway there, keep going!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header row: hearts (boss fights only) or the mute control, + live score */}
      <div className="flex items-center justify-between">
        {heartsEnabled ? <HeartsDisplay hearts={hearts} /> : <SoundToggle />}
        <div className="flex items-center gap-3">
          {/* No shield count here: shields are streak freezes now, spent between
              sessions rather than inside one, so the home screen is where they
              belong. */}
          {/* Live score display */}
          <div className="relative flex items-center gap-1">
            <span
              className="font-heading text-sm font-bold text-ink"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`Score: ${questionsCorrect} of ${activeQuestions.length} correct`}
            >
              <span aria-hidden>{questionsCorrect}/{activeQuestions.length}</span>
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
                  +{pointsFlash} pts
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-xs text-muted">
              · {totalPoints} pts
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

      <div
        className="h-2 overflow-hidden rounded-full bg-black/5"
        role="progressbar"
        aria-valuenow={qIndex + 1}
        aria-valuemin={1}
        aria-valuemax={activeQuestions.length}
        aria-label={`Question ${qIndex + 1} of ${activeQuestions.length}`}
      >
        <motion.div
          className="h-full rounded-full bg-teal"
          animate={{ width: `${(qIndex / activeQuestions.length) * 100}%` }}
          transition={{ duration: 0.4 }}
          aria-hidden
        />
      </div>

      <StudyBuddy buddyId={buddyId} mood={buddyMood} line={buddyLine} />

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
              <Star className="w-3.5 h-3.5" aria-hidden /> Bonus Challenge: double points!
            </motion.div>
          )}

          <div className="mb-5 flex items-start justify-between gap-3">
            <p className={`font-heading font-bold leading-snug text-ink ${youngMode ? 'text-2xl' : 'text-xl'}`}>
              <MathText text={q.question_text} />
            </p>
            <QuestionListenButton
              // distractors is always [] for multipart types (structured_answer,
              // true_false_grid, ordered_list, source_analysis, explain_example),
              // which collapses `choices` down to just q.correct_answer — reading
              // that aloud as a "choice" would speak the answer key itself. Only
              // read out real MCQ options.
              text={
                q.distractors.length > 0
                  ? `${q.question_text}. Your choices are: ${choices.join(', ')}.`
                  : q.question_text
              }
            />
          </div>

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

          {/* Hints — shown automatically after wrong attempts.
              aria-live so a child using a screen reader is told a clue appeared:
              nothing else moves focus on a wrong-but-not-final answer. */}
          {revealedHints.length > 0 && (
            <div className="mb-4 space-y-2" role="status" aria-live="polite">
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
              showRevealed={false}
            />
          )}

          {/* Technique hint — shown on first wrong attempt if question has a non-recall technique */}
          <AnimatePresence>
            {attempts === 1 && !questionDone && q.technique_hint && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-ink"
              >
                <span className="mr-1.5 font-bold text-on-maths inline-flex items-center gap-1">
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
                  ? "Not quite. Read the tip above and try again!"
                  : "Not quite. Here's a hint. Try again!"}
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
          ) : q.question_type === 'match_pairs' && Array.isArray(q.answer_parts) && (q.answer_parts as MatchPair[])[0]?.left !== undefined ? (
            <div className="mt-4">
              <MatchPairs
                pairs={q.answer_parts as MatchPair[]}
                onAnswer={handleMultiPartAnswer}
                disabled={questionDone}
              />
            </div>
          ) : q.question_type === 'short_answer_text' && Array.isArray(q.answer_parts) && (q.answer_parts as AcceptedAnswer[])[0]?.accept !== undefined ? (
            <TypeAnswer
              accepted={q.answer_parts as AcceptedAnswer[]}
              disabled={questionDone}
              young={youngMode}
              onSubmit={({ correct, matched }) => pick(matched, correct)}
            />
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
            <div
              className="mt-4 grid grid-cols-2 gap-3"
              role="group"
              aria-label="Answer choices"
            >
              {choices.map((choice) => {
                const isCorrectChoice = choice === q.correct_answer
                const isWrongPick = choice === lastPicked && !answeredCorrectly
                // Guardrail retry (young mode): a choice already ruled out this
                // question stays visible but stops being clickable, so a second
                // guess is narrower rather than harder.
                const isRuledOut = youngMode && !questionDone && ruledOut.has(choice)
                const imageUrl = q.option_images?.[choice]

                let cls =
                  `rounded-xl border-2 text-center font-heading font-bold text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    imageUrl ? 'flex flex-col items-center gap-2 p-3' : 'px-4 py-3'
                  } ${
                    youngMode ? 'min-h-[72px] text-lg' : 'min-h-[56px]'
                  }`
                if (!questionDone) {
                  if (choice === lastPicked && attempts > 0) {
                    cls += ' border-incorrect bg-incorrect/20 text-rose-700'
                  } else if (isRuledOut) {
                    cls += ' border-black/10 bg-background opacity-40'
                  } else {
                    cls += ' border-black/10 bg-background hover:border-brand hover:bg-brand/10'
                  }
                } else if (isCorrectChoice) {
                  cls += ' border-correct bg-correct/20 text-correct-700'
                } else if (isWrongPick) {
                  cls += ' border-incorrect bg-incorrect/20 text-rose-700'
                } else {
                  cls += ' border-black/10 bg-background opacity-50'
                }

                // Build an accessible label that includes the outcome state when answered
                let ariaLabel = choice
                if (questionDone) {
                  if (isCorrectChoice) ariaLabel = `${choice}, correct answer`
                  else if (isWrongPick) ariaLabel = `${choice}, your incorrect answer`
                } else if (isRuledOut) {
                  ariaLabel = `${choice}, already tried, pick a different answer`
                }

                return (
                  <motion.button
                    key={choice}
                    onClick={() => pick(choice)}
                    disabled={questionDone || isRuledOut}
                    whileTap={questionDone || isRuledOut ? {} : { scale: 0.97 }}
                    className={cls}
                    aria-label={ariaLabel}
                    aria-pressed={choice === lastPicked ? true : undefined}
                  >
                    {imageUrl ? (
                      <>
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-20 w-20 rounded-lg object-contain"
                        />
                        <span><MathText text={choice} /></span>
                      </>
                    ) : (
                      <MathText text={choice} />
                    )}
                  </motion.button>
                )
              })}
            </div>
          )}

          {/* Post-question feedback — aria-live so screen readers announce it;
               tabIndex so programmatic focus can land here after answering */}
          <div
            ref={feedbackRef}
            aria-live="polite"
            aria-atomic="true"
            tabIndex={-1}
            className="outline-none"
          >
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
                    <p className={`font-bold ${answeredCorrectly ? 'text-correct-700' : 'text-incorrect-700'}`}>
                      {answeredCorrectly
                        ? attempts === 0
                          ? isBonusQuestion
                            ? <span className="flex items-center gap-1"><Check className="w-4 h-4" aria-hidden /> Correct! Double points! <Star className="w-4 h-4" aria-hidden /></span>
                            : <span className="flex items-center gap-1"><Check className="w-4 h-4" aria-hidden /> Correct! Full marks!</span>
                          : <span className="flex items-center gap-1"><Check className="w-4 h-4" aria-hidden /> Got it on attempt {attempts + 1}!</span>
                        : <span className="flex items-center gap-1">
                            {/* aria-hidden on the ✗ symbol; the text carries the meaning */}
                            <span aria-hidden>✗</span>
                            <span>Not quite. The answer is <strong><MathText text={q.correct_answer} /></strong></span>
                          </span>}
                    </p>
                  )}
                  {isExhausted && (
                    <p className="mt-0.5 text-xs text-muted">No points this time, you&apos;ll get it next time!</p>
                  )}
                  {q.explanation && (
                    <p className="mt-1 text-sm text-muted"><MathText text={q.explanation} /></p>
                  )}
                  {q.technique_note && (
                    <p className="mt-2 text-xs font-semibold text-on-maths border-t border-brand/20 pt-2">
                      {q.technique_note}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {questionDone && !heartsDead && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-1">
              <button
                onClick={next}
                className="min-h-[48px] w-full rounded-xl bg-brand-600 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-brand-700"
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
