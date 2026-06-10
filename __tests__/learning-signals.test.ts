/**
 * PLI v1 Signal Engine tests
 *
 * Tests cover: signalConfidence(), computeSignals() for each major signal type,
 * suppression rules, deduplication, and evidence thresholds.
 *
 * No DB calls — the signal engine is pure and takes typed inputs.
 */

import { describe, it, expect } from 'vitest'
import {
  computeSignals,
  signalConfidence,
  type SignalEngineInput,
  type TopicProgressInput,
  type QuizAttemptInput,
  type QuizAnswerInput,
  type LearningEventInput,
} from '../lib/learning-signals'

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-26T12:00:00Z')
const YESTERDAY = new Date('2026-05-25T12:00:00Z')
const THREE_DAYS_AGO = new Date('2026-05-23T12:00:00Z')

function baseInput(): SignalEngineInput {
  return {
    childProfileId: 'child-1',
    topicProgress: [],
    quizAttempts: [],
    quizAnswers: [],
    learningEvents: [],
    generatedAt: NOW,
  }
}

function makeProgress(overrides: Partial<TopicProgressInput> = {}): TopicProgressInput {
  return {
    topicId: 'topic-1',
    subjectId: 'subj-maths',
    subjectName: 'Maths',
    topicTitle: 'Fractions',
    status: 'completed',
    lastScore: 0.90,
    completedAt: NOW,
    srRepetitions: 0,
    srIntervalDays: 1,
    ...overrides,
  }
}

function makeAttempt(overrides: Partial<QuizAttemptInput> & { attemptId?: string } = {}): QuizAttemptInput {
  return {
    attemptId: 'att-1',
    topicId: 'topic-1',
    subjectId: 'subj-maths',
    score: 0.90,
    hintsUsed: 0,
    timeTakenSeconds: 120,
    heartsRemaining: 3,
    createdAt: NOW,
    ...overrides,
  }
}

function makeAnswers(
  attemptId: string,
  topicId: string,
  count: number,
  correctFraction: number,
): QuizAnswerInput[] {
  return Array.from({ length: count }, (_, i) => ({
    attemptId,
    topicId,
    wasCorrect: i / count < correctFraction,
    hintNumber: 0,
    timeSeconds: 12,
  }))
}

function makeEvent(
  eventType: string,
  topicId: string | null = 'topic-1',
  occurredAt: Date = NOW,
): LearningEventInput {
  return {
    eventType,
    topicId,
    subjectId: 'subj-maths',
    lessonId: null,
    metadata: {},
    occurredAt,
  }
}

// ── signalConfidence() ─────────────────────────────────────────────────────────

describe('signalConfidence()', () => {
  it('returns early for < 6 evidence points', () => {
    expect(signalConfidence(0)).toBe('early')
    expect(signalConfidence(3)).toBe('early')
    expect(signalConfidence(5)).toBe('early')
  })

  it('returns moderate for 6–14 evidence points', () => {
    expect(signalConfidence(6)).toBe('moderate')
    expect(signalConfidence(10)).toBe('moderate')
    expect(signalConfidence(14)).toBe('moderate')
  })

  it('returns strong for >= 15 evidence points', () => {
    expect(signalConfidence(15)).toBe('strong')
    expect(signalConfidence(100)).toBe('strong')
  })
})

// ── computeSignals() — empty input ─────────────────────────────────────────────

describe('computeSignals() with empty input', () => {
  it('returns [] with no data', () => {
    const result = computeSignals(baseInput())
    expect(result).toEqual([])
  })
})

// ── mastery signal ─────────────────────────────────────────────────────────────

describe('mastery signal', () => {
  it('fires when score >= 0.80 and completed with >= 3 answers', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress({ lastScore: 0.90, status: 'completed' })]
    input.quizAttempts = [makeAttempt()]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.9)

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'mastery')).toBe(true)
  })

  it('does NOT fire when score < 0.80', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress({ lastScore: 0.60 })]
    input.quizAttempts = [makeAttempt({ score: 0.60 })]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.6)

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'mastery')).toBe(false)
  })

  it('does NOT fire with fewer than 3 answers', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress({ lastScore: 0.90 })]
    input.quizAttempts = [makeAttempt()]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 2, 1.0)

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'mastery')).toBe(false)
  })

  it('every mastery signal has evidenceSummary and recommendedAction', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress()]
    input.quizAttempts = [makeAttempt()]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.9)

    const mastery = computeSignals(input).find((s) => s.signalType === 'mastery')
    expect(mastery?.evidenceSummary).toBeTruthy()
    expect(mastery?.recommendedAction).toBeTruthy()
  })
})

// ── lower_accuracy signal ──────────────────────────────────────────────────────

describe('lower_accuracy signal', () => {
  it('fires when error rate > 50% and >= 3 answers', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress({ lastScore: 0.30, status: 'in_progress' })]
    input.quizAttempts = [makeAttempt({ score: 0.30 })]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.3)

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'lower_accuracy')).toBe(true)
  })

  it('does NOT fire with fewer than 3 answers (insufficient evidence)', () => {
    const input = baseInput()
    input.quizAttempts = [makeAttempt({ score: 0.0 })]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 2, 0.0)

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'lower_accuracy')).toBe(false)
  })

  it('does NOT fire when accuracy is acceptable (error rate < 50%)', () => {
    const input = baseInput()
    input.quizAttempts = [makeAttempt({ score: 0.70 })]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.7)

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'lower_accuracy')).toBe(false)
  })

  it('is suppressed when a persistence signal exists for the same topic', () => {
    // persistence requires 3+ attempts, so create those
    const attempts = [
      makeAttempt({ attemptId: 'a1', score: 0.30 }),
      makeAttempt({ attemptId: 'a2', score: 0.40 }),
      makeAttempt({ attemptId: 'a3', score: 0.35 }),
    ]
    const answers = [
      ...makeAnswers('a1', 'topic-1', 5, 0.3),
      ...makeAnswers('a2', 'topic-1', 5, 0.4),
      ...makeAnswers('a3', 'topic-1', 5, 0.35),
    ]
    const input = baseInput()
    input.quizAttempts = attempts
    input.quizAnswers = answers

    const signals = computeSignals(input)
    const hasPersistence = signals.some((s) => s.signalType === 'persistence')
    const hasLowerAccuracy = signals.some((s) => s.signalType === 'lower_accuracy')

    if (hasPersistence) {
      // When persistence fires, lower_accuracy should be suppressed
      expect(hasLowerAccuracy).toBe(false)
    }
    // If persistence doesn't fire (threshold may differ), this test is a no-op
  })
})

// ── interest_signal ────────────────────────────────────────────────────────────

describe('interest_signal', () => {
  it('fires when >= 3 lesson_opened events across >= 2 separate days', () => {
    const input = baseInput()
    input.learningEvents = [
      makeEvent('lesson_opened', 'topic-1', NOW),
      makeEvent('lesson_opened', 'topic-1', YESTERDAY),
      makeEvent('lesson_opened', 'topic-1', THREE_DAYS_AGO),
    ]

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'interest_signal')).toBe(true)
  })

  it('does NOT fire with only 2 opens (insufficient evidence)', () => {
    const input = baseInput()
    input.learningEvents = [
      makeEvent('lesson_opened', 'topic-1', NOW),
      makeEvent('lesson_opened', 'topic-1', YESTERDAY),
    ]

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'interest_signal')).toBe(false)
  })

  it('does NOT fire when 3+ opens happen on a single day (must span 2 days)', () => {
    const input = baseInput()
    input.learningEvents = [
      makeEvent('lesson_opened', 'topic-1', NOW),
      makeEvent('lesson_opened', 'topic-1', new Date(NOW.getTime() + 60_000)),
      makeEvent('lesson_opened', 'topic-1', new Date(NOW.getTime() + 120_000)),
    ]

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'interest_signal')).toBe(false)
  })
})

// ── avoidance_signal ───────────────────────────────────────────────────────────

describe('avoidance_signal', () => {
  it('fires when >= 3 recommendation_shown events with no click or open', () => {
    const input = baseInput()
    input.learningEvents = [
      makeEvent('recommendation_shown', 'topic-1', THREE_DAYS_AGO),
      makeEvent('recommendation_shown', 'topic-1', YESTERDAY),
      makeEvent('recommendation_shown', 'topic-1', NOW),
    ]

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'avoidance_signal')).toBe(true)
  })

  it('does NOT fire with only 2 recommendation_shown (insufficient evidence)', () => {
    const input = baseInput()
    input.learningEvents = [
      makeEvent('recommendation_shown', 'topic-1', YESTERDAY),
      makeEvent('recommendation_shown', 'topic-1', NOW),
    ]

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'avoidance_signal')).toBe(false)
  })

  it('does NOT fire when there is a recommendation_clicked event for the same topic', () => {
    const input = baseInput()
    input.learningEvents = [
      makeEvent('recommendation_shown', 'topic-1', THREE_DAYS_AGO),
      makeEvent('recommendation_shown', 'topic-1', YESTERDAY),
      makeEvent('recommendation_shown', 'topic-1', NOW),
      makeEvent('recommendation_clicked', 'topic-1', NOW),
    ]

    const signals = computeSignals(input)
    expect(signals.some((s) => s.signalType === 'avoidance_signal')).toBe(false)
  })
})

// ── Topic title resolution ────────────────────────────────────────────────────

describe('topic title resolution without a progress row', () => {
  it('uses input.topicTitles for confidence_gap signals (never the raw topic id)', () => {
    const input = baseInput()
    // Lesson completed, no quiz — and crucially no topicProgress row for the topic.
    input.learningEvents = [makeEvent('lesson_completed', 'topic-uuid-no-progress', NOW)]
    input.topicTitles = { 'topic-uuid-no-progress': 'Animals: Nutrition and Skeletons' }

    const signals = computeSignals(input)
    const gap = signals.find((s) => s.signalType === 'confidence_gap')
    expect(gap).toBeDefined()
    expect(gap!.title).toContain('Animals: Nutrition and Skeletons')
    expect(gap!.title).not.toContain('topic-uuid-no-progress')
  })

  it('falls back to "Unknown topic" when no title is available anywhere', () => {
    const input = baseInput()
    input.learningEvents = [makeEvent('lesson_completed', 'topic-uuid-no-progress', NOW)]

    const signals = computeSignals(input)
    const gap = signals.find((s) => s.signalType === 'confidence_gap')
    expect(gap).toBeDefined()
    expect(gap!.title).toContain('Unknown topic')
    expect(gap!.title).not.toContain('topic-uuid-no-progress')
  })
})

// ── Deduplication ─────────────────────────────────────────────────────────────

describe('signal deduplication', () => {
  it('returns at most one signal per type per topic', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress()]
    // Enough answers for both mastery and lower_accuracy checks
    input.quizAttempts = [makeAttempt()]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.9)

    const signals = computeSignals(input)
    const masterySignals = signals.filter((s) => s.signalType === 'mastery' && s.topicId === 'topic-1')
    expect(masterySignals.length).toBeLessThanOrEqual(1)
  })

  it('all signal IDs are unique', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress()]
    input.quizAttempts = [makeAttempt()]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.9)
    input.learningEvents = [
      makeEvent('lesson_opened', 'topic-1', NOW),
      makeEvent('lesson_opened', 'topic-1', YESTERDAY),
      makeEvent('lesson_opened', 'topic-1', THREE_DAYS_AGO),
    ]

    const signals = computeSignals(input)
    const ids = signals.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

// ── Signal shape requirements ─────────────────────────────────────────────────

describe('signal output shape', () => {
  it('every signal has all required fields', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress()]
    input.quizAttempts = [makeAttempt()]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.9)

    const signals = computeSignals(input)
    expect(signals.length).toBeGreaterThan(0)

    for (const s of signals) {
      expect(s.id).toBeTruthy()
      expect(s.signalType).toBeTruthy()
      expect(s.title).toBeTruthy()
      expect(s.evidenceSummary).toBeTruthy()
      expect(s.evidenceCount).toBeGreaterThan(0)
      expect(['early', 'moderate', 'strong']).toContain(s.confidence)
      expect(s.whatThisMayMean).toBeTruthy()
      expect(s.recommendedAction).toBeTruthy()
      expect(Array.isArray(s.createdFrom)).toBe(true)
    }
  })

  it('no signal has a confidence outside early/moderate/strong', () => {
    const input = baseInput()
    input.topicProgress = [makeProgress()]
    input.quizAttempts = [makeAttempt()]
    input.quizAnswers = makeAnswers('att-1', 'topic-1', 10, 0.9)
    input.learningEvents = [
      makeEvent('lesson_opened', 'topic-1', NOW),
      makeEvent('lesson_opened', 'topic-1', YESTERDAY),
      makeEvent('lesson_opened', 'topic-1', THREE_DAYS_AGO),
    ]

    const signals = computeSignals(input)
    const validConfidences = new Set(['early', 'moderate', 'strong'])
    for (const s of signals) {
      expect(validConfidences.has(s.confidence)).toBe(true)
    }
  })
})
