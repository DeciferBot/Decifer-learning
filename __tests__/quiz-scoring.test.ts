/**
 * Server-side answer verification tests.
 *
 * The client sends wasCorrect with every answer. A crafted POST can claim
 * anything, and scoreQuizAttempt scores whatever log it is handed, so every
 * route must re-check each answer against the stored correct_answer first.
 * These tests cover the shared helper and pin the behaviour of the two routes
 * that used to hand scoreQuizAttempt the raw client log:
 *   - /api/guardian/[zoneId]/submit  (points + Legendary card + Guardian Slayer)
 *   - /api/quiz/checkpoint           (quiz_attempt score → IRT + anomaly detection)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scoreAnswers, MULTIPART_TYPES, type SubmittedAnswer, type AnswerKeyRow } from '../lib/points'

function answer(over: Partial<SubmittedAnswer> = {}): SubmittedAnswer {
  return {
    questionId: 'q1',
    childAnswer: '42',
    wasCorrect: true,
    hintNumber: 0,
    timeSeconds: 5,
    ...over,
  }
}

function key(over: Partial<AnswerKeyRow> = {}): AnswerKeyRow {
  return { id: 'q1', correct_answer: '42', question_type: 'maths_arithmetic', ...over }
}

// ── The shared helper ──────────────────────────────────────────────────────

describe('scoreAnswers', () => {
  it('marks a matching answer correct', () => {
    expect(scoreAnswers([answer()], [key()])[0].wasCorrect).toBe(true)
  })

  it('OVERRIDES a client claiming correct when the answer is wrong', () => {
    const out = scoreAnswers([answer({ childAnswer: '99', wasCorrect: true })], [key()])
    expect(out[0].wasCorrect).toBe(false)
  })

  it('OVERRIDES a client claiming wrong when the answer is right', () => {
    const out = scoreAnswers([answer({ childAnswer: '42', wasCorrect: false })], [key()])
    expect(out[0].wasCorrect).toBe(true)
  })

  it('compares case- and whitespace-insensitively', () => {
    const out = scoreAnswers(
      [answer({ childAnswer: '  Paris ' })],
      [key({ correct_answer: 'paris', question_type: 'geography_factual' })],
    )
    expect(out[0].wasCorrect).toBe(true)
  })

  it('scores an unknown question wrong (not published, wrong topic, or invented id)', () => {
    // No key row at all — the classic forged-payload shape.
    expect(scoreAnswers([answer()], [])[0].wasCorrect).toBe(false)
    // A key for a different question must not leak across.
    expect(scoreAnswers([answer({ questionId: 'q9' })], [key()])[0].wasCorrect).toBe(false)
  })

  it('scores a blank or missing answer wrong even when the client claims correct', () => {
    expect(scoreAnswers([answer({ childAnswer: '' })], [key()])[0].wasCorrect).toBe(false)
    expect(scoreAnswers([answer({ childAnswer: '   ' })], [key()])[0].wasCorrect).toBe(false)
    expect(
      scoreAnswers(
        [answer({ childAnswer: undefined as unknown as string })],
        [key()],
      )[0].wasCorrect,
    ).toBe(false)
  })

  it('does not throw when childAnswer is not a string', () => {
    const out = scoreAnswers([answer({ childAnswer: { a: 1 } as unknown as string })], [key()])
    expect(out[0].wasCorrect).toBe(false)
  })

  it('trusts the client for multi-part types, which have no comparable correct_answer', () => {
    for (const type of MULTIPART_TYPES) {
      const k = [key({ question_type: type, correct_answer: 'n/a' })]
      expect(scoreAnswers([answer({ childAnswer: 'correct', wasCorrect: true })], k)[0].wasCorrect).toBe(true)
      expect(scoreAnswers([answer({ childAnswer: 'incorrect', wasCorrect: false })], k)[0].wasCorrect).toBe(false)
    }
  })

  it('still rejects a blank multi-part answer claiming correct', () => {
    const k = [key({ question_type: 'structured_answer', correct_answer: 'n/a' })]
    expect(scoreAnswers([answer({ childAnswer: '', wasCorrect: true })], k)[0].wasCorrect).toBe(false)
  })

  it('preserves the other answer fields untouched', () => {
    const out = scoreAnswers([answer({ hintNumber: 2, timeSeconds: 31 })], [key()])
    expect(out[0]).toMatchObject({ questionId: 'q1', childAnswer: '42', hintNumber: 2, timeSeconds: 31 })
  })

  it('scores a forged all-correct 15-question Guardian payload as zero', () => {
    const forged = Array.from({ length: 15 }, (_, i) =>
      answer({ questionId: `q${i}`, childAnswer: 'anything', wasCorrect: true }),
    )
    const realKey = Array.from({ length: 15 }, (_, i) =>
      key({ id: `q${i}`, correct_answer: `real-answer-${i}` }),
    )
    expect(scoreAnswers(forged, realKey).filter((a) => a.wasCorrect)).toHaveLength(0)
  })
})

// ── Route wiring ───────────────────────────────────────────────────────────
// Proves the two routes actually call the helper, and that a forged payload
// wins nothing. Everything the routes touch is mocked; no DB, no network.

const prismaMock = {
  profile: { findUnique: vi.fn(), update: vi.fn() },
  zone: { findFirst: vi.fn() },
  topic: { findMany: vi.fn() },
  topicProgress: { count: vi.fn() },
  quizQuestion: { findMany: vi.fn() },
  quizAttempt: { create: vi.fn() },
  quizAnswer: { createMany: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}))
vi.mock('@/lib/parent-notify', () => ({ notifyParentBigMoment: vi.fn() }))

const PROFILE = {
  id: 'profile-1',
  user_id: 'user-1',
  display_name: 'Test Child',
  year_group_id: 'yg-1',
  total_points: 100,
  streak_days: 3,
}

function post(body: unknown) {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// 15 answers claiming a clean sweep, all with the wrong text.
const FORGED_GUARDIAN = Array.from({ length: 15 }, (_, i) => ({
  questionId: `q${i}`,
  childAnswer: 'I am cheating',
  wasCorrect: true,
  hintNumber: 0,
  timeSeconds: 1,
}))

const GUARDIAN_KEY = Array.from({ length: 15 }, (_, i) => ({
  id: `q${i}`,
  correct_answer: `answer-${i}`,
  question_type: 'maths_arithmetic',
}))

describe('POST /api/guardian/[zoneId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.profile.findUnique.mockResolvedValue(PROFILE)
    prismaMock.zone.findFirst.mockResolvedValue({ id: 'zone-1', name: 'Number Jungle' })
    prismaMock.quizQuestion.findMany.mockResolvedValue(GUARDIAN_KEY)
    // Zone earned by default: 4 published topics, all 4 completed.
    prismaMock.topic.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }])
    prismaMock.topicProgress.count.mockResolvedValue(4)
  })

  it('refuses a child who has not finished the zone', async () => {
    prismaMock.topicProgress.count.mockResolvedValue(3) // 3 of 4 topics done

    const honest = GUARDIAN_KEY.map((q) => ({
      questionId: q.id,
      childAnswer: q.correct_answer,
      wasCorrect: true,
      hintNumber: 0,
      timeSeconds: 4,
    }))

    const { POST } = await import('@/app/api/guardian/[zoneId]/submit/route')
    const res = await POST(
      post({ answers: honest, timeTakenSeconds: 60, heartsRemaining: 3 }),
      { params: { zoneId: 'zone-1' } },
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.code).toBe('GUARDIAN_LOCKED')
    expect(json.completedTopics).toBe(3)
    expect(json.totalTopics).toBe(4)
    // Perfect answers, but the boss was not earned: nothing awarded.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a zone with no published topics', async () => {
    prismaMock.topic.findMany.mockResolvedValue([])
    prismaMock.topicProgress.count.mockResolvedValue(0)

    const { POST } = await import('@/app/api/guardian/[zoneId]/submit/route')
    const res = await POST(
      post({ answers: FORGED_GUARDIAN, timeTakenSeconds: 10, heartsRemaining: 3 }),
      { params: { zoneId: 'zone-1' } },
    )
    expect(res.status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('awards nothing for a forged all-correct payload', async () => {
    const { POST } = await import('@/app/api/guardian/[zoneId]/submit/route')
    const res = await POST(
      post({ answers: FORGED_GUARDIAN, timeTakenSeconds: 10, heartsRemaining: 3 }),
      { params: { zoneId: 'zone-1' } },
    )
    const json = await res.json()

    expect(json.passed).toBe(false)
    expect(json.points).toBe(0)
    expect(json.score).toBe(0)
    expect(json.droppedCard).toBeNull()
    expect(json.newBadges).toEqual([])
    // No card, badge or point writes happened at all.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('scopes the answer key to published questions in the zone', async () => {
    const { POST } = await import('@/app/api/guardian/[zoneId]/submit/route')
    await POST(
      post({ answers: FORGED_GUARDIAN, timeTakenSeconds: 10, heartsRemaining: 3 }),
      { params: { zoneId: 'zone-1' } },
    )
    const where = prismaMock.quizQuestion.findMany.mock.calls[0][0].where
    expect(where.status).toBe('published')
    expect(where.topic).toEqual({ zone_id: 'zone-1', is_published: true })
  })

  it('still awards a genuine win', async () => {
    const tx = {
      pointEvent: { create: vi.fn() },
      profile: { update: vi.fn() },
      cardCatalog: { findMany: vi.fn().mockResolvedValue([]) },
      childCollection: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
      profileBadge: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
      badge: { findMany: vi.fn().mockResolvedValue([]) },
    }
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))

    const honest = GUARDIAN_KEY.map((q) => ({
      questionId: q.id,
      childAnswer: q.correct_answer,
      wasCorrect: true,
      hintNumber: 0,
      timeSeconds: 4,
    }))

    const { POST } = await import('@/app/api/guardian/[zoneId]/submit/route')
    const res = await POST(
      post({ answers: honest, timeTakenSeconds: 60, heartsRemaining: 3 }),
      { params: { zoneId: 'zone-1' } },
    )
    const json = await res.json()

    expect(json.passed).toBe(true)
    expect(json.score).toBe(15)
    expect(json.points).toBe(175) // 15 × 10 + 25 perfect bonus
    expect(tx.pointEvent.create).toHaveBeenCalled()
  })

  it('ignores forged "I got it on the retry" rows appended to real wrong answers', async () => {
    // Every question genuinely wrong, then a second row per question claiming a
    // correct retry. Verification kills the claim, so credit stays at zero.
    const wrongThenClaim = GUARDIAN_KEY.flatMap((q) => [
      { questionId: q.id, childAnswer: 'wrong', wasCorrect: false, hintNumber: 0, timeSeconds: 3 },
      { questionId: q.id, childAnswer: 'still wrong', wasCorrect: true, hintNumber: 0, timeSeconds: 3 },
    ])

    const { POST } = await import('@/app/api/guardian/[zoneId]/submit/route')
    const res = await POST(
      post({ answers: wrongThenClaim.slice(0, 30), timeTakenSeconds: 90, heartsRemaining: 1 }),
      { params: { zoneId: 'zone-1' } },
    )
    const json = await res.json()

    expect(json.passed).toBe(false)
    expect(json.scoreFraction).toBe(0)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects an oversized answer list', async () => {
    const { POST } = await import('@/app/api/guardian/[zoneId]/submit/route')
    const res = await POST(
      post({ answers: Array.from({ length: 51 }, () => FORGED_GUARDIAN[0]), timeTakenSeconds: 1, heartsRemaining: 3 }),
      { params: { zoneId: 'zone-1' } },
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/quiz/checkpoint', () => {
  const CHECKPOINT_KEY = [
    { id: 'q0', correct_answer: 'answer-0', question_type: 'maths_arithmetic' },
    { id: 'q1', correct_answer: 'answer-1', question_type: 'maths_arithmetic' },
    { id: 'q2', correct_answer: 'answer-2', question_type: 'maths_arithmetic' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.profile.findUnique.mockResolvedValue({ id: 'profile-1' })
    prismaMock.quizQuestion.findMany.mockResolvedValue(CHECKPOINT_KEY)
    prismaMock.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' })
    prismaMock.quizAnswer.createMany.mockResolvedValue({ count: 3 })
  })

  it('records a zero score for a forged all-correct payload', async () => {
    const { POST } = await import('@/app/api/quiz/checkpoint/route')
    const res = await POST(
      post({
        topicId: 'topic-1',
        answers: CHECKPOINT_KEY.map((q) => ({
          questionId: q.id,
          childAnswer: 'nope',
          wasCorrect: true,
          hintNumber: 0,
          timeSeconds: 2,
        })),
        timeTakenSeconds: 20,
        heartsRemaining: 3,
      }),
    )
    const json = await res.json()

    expect(json.passed).toBe(false)
    expect(json.score).toBe(0)
    // The attempt row that feeds IRT + anomaly detection holds the real score.
    expect(prismaMock.quizAttempt.create.mock.calls[0][0].data.score).toBe(0)
    // Every persisted answer is marked wrong.
    const rows = prismaMock.quizAnswer.createMany.mock.calls[0][0].data
    expect(rows.every((r: { was_correct: boolean }) => r.was_correct === false)).toBe(true)
  })

  it('passes a genuine 2 of 3, first try each', async () => {
    const { POST } = await import('@/app/api/quiz/checkpoint/route')
    const res = await POST(
      post({
        topicId: 'topic-1',
        answers: [
          { questionId: 'q0', childAnswer: 'answer-0', wasCorrect: true, hintNumber: 0, timeSeconds: 2 },
          { questionId: 'q1', childAnswer: 'answer-1', wasCorrect: true, hintNumber: 1, timeSeconds: 2 },
          // Client claims correct; the stored answer says otherwise.
          { questionId: 'q2', childAnswer: 'wrong', wasCorrect: true, hintNumber: 0, timeSeconds: 2 },
        ],
        timeTakenSeconds: 20,
        heartsRemaining: 3,
      }),
    )
    const json = await res.json()

    expect(json.score).toBeCloseTo(2 / 3)
    // The pass line is 0.66, not 0.67, so 2/3 (0.6667) clears it.
    expect(json.passed).toBe(true)
  })

  it('fails 1 of 3', async () => {
    const { POST } = await import('@/app/api/quiz/checkpoint/route')
    const res = await POST(
      post({
        topicId: 'topic-1',
        answers: [
          { questionId: 'q0', childAnswer: 'answer-0', wasCorrect: true, hintNumber: 0, timeSeconds: 2 },
          { questionId: 'q1', childAnswer: 'nope', wasCorrect: true, hintNumber: 0, timeSeconds: 2 },
          { questionId: 'q2', childAnswer: 'nope', wasCorrect: true, hintNumber: 0, timeSeconds: 2 },
        ],
        timeTakenSeconds: 20,
        heartsRemaining: 3,
      }),
    )
    const json = await res.json()

    expect(json.score).toBeCloseTo(1 / 3)
    expect(json.passed).toBe(false)
  })

  it('passes a clean sweep', async () => {
    const { POST } = await import('@/app/api/quiz/checkpoint/route')
    const res = await POST(
      post({
        topicId: 'topic-1',
        answers: CHECKPOINT_KEY.map((q) => ({
          questionId: q.id,
          childAnswer: q.correct_answer,
          wasCorrect: false, // client understates; the server still scores it right
          hintNumber: 0,
          timeSeconds: 2,
        })),
        timeTakenSeconds: 20,
        heartsRemaining: 3,
      }),
    )
    const json = await res.json()

    expect(json.passed).toBe(true)
    expect(json.score).toBe(1)
  })

  it('gives a genuine second-try win two-thirds credit, verified answers and all', async () => {
    // q0 right first go, q1 wrong then right, q2 right. Credit: 1 + ⅔ + 1 of 3.
    const { POST } = await import('@/app/api/quiz/checkpoint/route')
    const res = await POST(
      post({
        topicId: 'topic-1',
        answers: [
          { questionId: 'q0', childAnswer: 'answer-0', wasCorrect: true, hintNumber: 0, timeSeconds: 2 },
          { questionId: 'q1', childAnswer: 'nope', wasCorrect: false, hintNumber: 0, timeSeconds: 2 },
          { questionId: 'q1', childAnswer: 'answer-1', wasCorrect: true, hintNumber: 0, timeSeconds: 3 },
          { questionId: 'q2', childAnswer: 'answer-2', wasCorrect: true, hintNumber: 0, timeSeconds: 2 },
        ],
        timeTakenSeconds: 20,
        heartsRemaining: 3,
      }),
    )
    const json = await res.json()

    expect(json.scoreFraction).toBeCloseTo((1 + 2 / 3 + 1) / 3)
    expect(json.passed).toBe(true)
    expect(json.totalQuestions).toBe(3)
  })

  it('scopes the answer key to published questions in the submitted topic', async () => {
    const { POST } = await import('@/app/api/quiz/checkpoint/route')
    await POST(
      post({
        topicId: 'topic-1',
        answers: [{ questionId: 'q0', childAnswer: 'x', wasCorrect: true, hintNumber: 0, timeSeconds: 1 }],
        timeTakenSeconds: 5,
        heartsRemaining: 3,
      }),
    )
    const where = prismaMock.quizQuestion.findMany.mock.calls[0][0].where
    expect(where.status).toBe('published')
    expect(where.topic_id).toBe('topic-1')
  })
})
