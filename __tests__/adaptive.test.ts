/**
 * Adaptive content-selection tests — guards the SAFETY CONTRACT in lib/adaptive.ts:
 *   1. ONLY status='published' content is ever returned (the §8 hard rule).
 *   2. Tier balance, dedup, recently-seen avoidance, and graceful small-pool fallback.
 *   3. An empty pool returns [] with a logged reason — never throws at a child.
 *
 * Uses a chainable in-memory fake of the Supabase client — no DB, no network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  selectQuizQuestions,
  selectPracticeItems,
  selectInterleavedQuestions,
  rotateFillBlankItems,
  type AdaptiveQuestion,
} from '../lib/adaptive'

// ── Fake Supabase ───────────────────────────────────────────────────────────
//
// Records every .eq() so tests can assert the published-only filter was applied,
// and resolves chained queries against in-memory tables.

type Row = Record<string, unknown>
interface FakeDB {
  quiz_questions?: Row[]
  quiz_attempts?: Row[]
  quiz_answers?: Row[]
}

function makeSupabase(tables: FakeDB) {
  const eqCalls: Array<{ table: string; col: string; val: unknown }> = []

  function from(table: string) {
    const filters: Record<string, unknown> = {}
    let inFilter: { col: string; vals: unknown[] } | null = null
    let order: { col: string; ascending: boolean } | null = null
    let limit: number | null = null

    function resolve() {
      let rows = [...((tables as Record<string, Row[]>)[table] ?? [])]
      rows = rows.filter((r) => Object.entries(filters).every(([c, v]) => r[c] === v))
      if (inFilter) rows = rows.filter((r) => inFilter!.vals.includes(r[inFilter!.col]))
      if (order) {
        rows.sort((a, b) => {
          const av = a[order!.col] as number
          const bv = b[order!.col] as number
          return order!.ascending ? av - bv : bv - av
        })
      }
      if (limit != null) rows = rows.slice(0, limit)
      return Promise.resolve({ data: rows, error: null })
    }

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters[col] = val
        eqCalls.push({ table, col, val })
        return builder
      },
      in: (col: string, vals: unknown[]) => {
        inFilter = { col, vals }
        return builder
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        order = { col, ascending: opts?.ascending ?? true }
        return builder
      },
      limit: (n: number) => {
        limit = n
        return resolve()
      },
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        resolve().then(onF, onR),
    }
    return builder
  }

  return { client: { from } as never, eqCalls }
}

// ── Fixtures ──────────────────────────────────────────────────────────────

let qid = 0
function q(tier: AdaptiveQuestion['tier'], status = 'published', extra: Row = {}): Row {
  qid++
  return {
    id: `q${qid}`,
    topic_id: 'topic-1',
    tier,
    status,
    question_type: 'maths_arithmetic',
    question_text: `Q${qid}`,
    correct_answer: '1',
    distractors: [],
    hint_1: null, hint_2: null, hint_3: null, explanation: null,
    worked_example: null, technique_type: null, technique_hint: null, technique_note: null,
    answer_parts: null, source_text: null, source_label: null, source_type: null,
    foundation_images: null,
    created_at: qid,
    ...extra,
  }
}

function bigPool(topicId = 'topic-1'): Row[] {
  // 8 sprout, 8 explorer, 8 lightning = 24 published questions
  const rows: Row[] = []
  for (const tier of ['sprout', 'explorer', 'lightning'] as const) {
    for (let i = 0; i < 8; i++) rows.push(q(tier, 'published', { topic_id: topicId }))
  }
  return rows
}

beforeEach(() => {
  qid = 0
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

// ── selectQuizQuestions ────────────────────────────────────────────────────

describe('selectQuizQuestions — safety contract', () => {
  it('NEVER returns non-published content, even when staged/flagged rows exist', async () => {
    const pool = [
      ...bigPool(),
      q('sprout', 'staged'),
      q('explorer', 'flagged'),
      q('lightning', 'regenerating'),
    ]
    const { client } = makeSupabase({ quiz_questions: pool })
    const result = await selectQuizQuestions(client, 'child-1', 'topic-1', { count: 10 })

    const publishedIds = new Set(pool.filter((r) => r.status === 'published').map((r) => r.id))
    expect(result.length).toBe(10)
    for (const item of result) expect(publishedIds.has(item.id)).toBe(true)
  })

  it('applies an explicit status=published filter at the query layer', async () => {
    const { client, eqCalls } = makeSupabase({ quiz_questions: bigPool() })
    await selectQuizQuestions(client, 'child-1', 'topic-1', { count: 10 })
    expect(
      eqCalls.some((c) => c.table === 'quiz_questions' && c.col === 'status' && c.val === 'published'),
    ).toBe(true)
  })

  it('returns the requested count with no duplicate question ids', async () => {
    const { client } = makeSupabase({ quiz_questions: bigPool() })
    const result = await selectQuizQuestions(client, 'child-1', 'topic-1', { count: 10 })
    expect(result.length).toBe(10)
    expect(new Set(result.map((r) => r.id)).size).toBe(10)
  })

  it('respects the ~40/40/20 tier balance when the pool is rich', async () => {
    const { client } = makeSupabase({ quiz_questions: bigPool() })
    const result = await selectQuizQuestions(client, 'child-1', 'topic-1', { count: 10 })
    const counts = { sprout: 0, explorer: 0, lightning: 0 }
    for (const r of result) counts[r.tier]++
    // ceil(4)/ceil(4)/floor(2) targets, with shortfall fill — allow a small drift.
    expect(counts.sprout).toBeGreaterThanOrEqual(3)
    expect(counts.explorer).toBeGreaterThanOrEqual(3)
    expect(counts.lightning).toBeGreaterThanOrEqual(1)
  })

  it('returns [] (never throws) when the topic has no published questions', async () => {
    const { client } = makeSupabase({ quiz_questions: [q('sprout', 'staged')] })
    const result = await selectQuizQuestions(client, 'child-1', 'topic-1', { count: 10 })
    expect(result).toEqual([])
  })

  it('uses the whole pool when it is smaller than the requested count', async () => {
    const small = [q('sprout'), q('explorer'), q('lightning')]
    const { client } = makeSupabase({ quiz_questions: small })
    const result = await selectQuizQuestions(client, 'child-1', 'topic-1', { count: 10 })
    expect(result.length).toBe(3)
  })

  it('prefers questions not seen in the recent lookback window', async () => {
    const pool = bigPool()
    // Mark the first 12 question ids as answered in a recent attempt.
    const seenIds = pool.slice(0, 12).map((r) => r.id as string)
    const attempts = [{ id: 'att-1', profile_id: 'child-1', topic_id: 'topic-1', created_at: 100 }]
    const answers = seenIds.map((question_id) => ({
      attempt_id: 'att-1', question_id, was_correct: true,
    }))
    const { client } = makeSupabase({ quiz_questions: pool, quiz_attempts: attempts, quiz_answers: answers })
    const result = await selectQuizQuestions(client, 'child-1', 'topic-1', { count: 10, lookbackAttempts: 2 })
    // 12 fresh remain (24 - 12 seen), enough for a full fresh quiz → none should be from the seen set.
    const seenSet = new Set(seenIds)
    const overlap = result.filter((r) => seenSet.has(r.id)).length
    expect(overlap).toBe(0)
  })
})

// ── selectPracticeItems ────────────────────────────────────────────────────

describe('selectPracticeItems', () => {
  it('only returns published items and reports the true pool size', async () => {
    const pool = [...bigPool(), q('sprout', 'staged')]
    const { client } = makeSupabase({ quiz_questions: pool })
    const res = await selectPracticeItems(client, 'child-1', 'topic-1', { maxItems: 12 })
    expect(res.contentPoolSize).toBe(24) // staged excluded
    expect(new Set(res.questions.map((q) => q.id)).size).toBe(res.questions.length)
  })

  it('flags an empty pool with a fallback reason instead of throwing', async () => {
    const { client } = makeSupabase({ quiz_questions: [] })
    const res = await selectPracticeItems(client, 'child-1', 'topic-1')
    expect(res.questions).toEqual([])
    expect(res.fallbackReason).toMatch(/no published questions/i)
  })

  it('surfaces mistake-review items the child previously got wrong', async () => {
    const pool = bigPool()
    const wrongId = pool[0].id as string
    const attempts = [{ id: 'att-1', profile_id: 'child-1', topic_id: 'topic-1', created_at: 100 }]
    const answers = [{ attempt_id: 'att-1', question_id: wrongId, was_correct: false }]
    const { client } = makeSupabase({ quiz_questions: pool, quiz_attempts: attempts, quiz_answers: answers })
    const res = await selectPracticeItems(client, 'child-1', 'topic-1', { maxItems: 12 })
    expect(res.mistakeReviewCount).toBeGreaterThanOrEqual(1)
  })
})

// ── selectInterleavedQuestions ─────────────────────────────────────────────

describe('selectInterleavedQuestions', () => {
  it('returns [] for no topics', async () => {
    const { client } = makeSupabase({})
    expect(await selectInterleavedQuestions(client, 'child-1', [])).toEqual([])
  })

  it('pulls a mix from multiple topics, only published, capped at totalCount', async () => {
    const t1 = bigPool('topic-1')
    const t2 = bigPool('topic-2')
    const t3 = bigPool('topic-3')
    const { client } = makeSupabase({ quiz_questions: [...t1, ...t2, ...t3] })
    const res = await selectInterleavedQuestions(client, 'child-1', ['topic-1', 'topic-2', 'topic-3'], 10)
    expect(res.length).toBeLessThanOrEqual(10)
    expect(res.length).toBeGreaterThan(0)
    const topics = new Set(res.map((r) => (r as unknown as Row).topic_id))
    expect(topics.size).toBeGreaterThan(1) // genuinely interleaved
  })
})

// ── rotateFillBlankItems (pure) ────────────────────────────────────────────

describe('rotateFillBlankItems', () => {
  it('returns all items (shuffled) when at or under the cap', () => {
    const items = [1, 2, 3, 4]
    const out = rotateFillBlankItems(items, 10)
    expect(out.slice().sort()).toEqual([1, 2, 3, 4])
  })

  it('caps to maxShow when there are more items than the cap', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const out = rotateFillBlankItems(items, 10)
    expect(out.length).toBe(10)
    expect(new Set(out).size).toBe(10) // no dupes introduced
  })

  it('does not mutate the input array', () => {
    const items = [1, 2, 3]
    const copy = [...items]
    rotateFillBlankItems(items, 2)
    expect(items).toEqual(copy)
  })
})
