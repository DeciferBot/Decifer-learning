/**
 * The paper shape and the adaptive ladder.
 *
 * The thing worth proving here is that an item is a pure function of (token,
 * answers so far). Everything the feature promises rests on that: a reload gets
 * the same question, a double-tap cannot move the ladder twice, and a bug report
 * is reproducible from a seed.
 */

import { describe, it, expect } from 'vitest'
import {
  AGE_BANDS,
  ITEMS_PER_TYPE,
  START_LEVEL,
  TOTAL_ITEMS,
  isAgeBand,
  levelAfter,
  nextLevel,
  planTypes,
  seedFor,
} from '@/lib/reasoning/plan'
import {
  MAX_LEVEL,
  MIN_LEVEL,
  REASONING_ITEM_TYPES,
  generateItem,
  validateItem,
  type Level,
} from '@/lib/reasoning/generate'

const TOKENS = ['a3f1', 'b7c2', '00000000-0000-0000-0000-000000000001', 'zzz']

describe('paper shape', () => {
  it('is 24 questions, six of each type', () => {
    expect(TOTAL_ITEMS).toBe(24)
    expect(ITEMS_PER_TYPE).toBe(6)
  })

  it('gives exactly six of every type, whatever the token', () => {
    for (const token of TOKENS) {
      const types = planTypes(token)
      expect(types).toHaveLength(TOTAL_ITEMS)
      for (const type of REASONING_ITEM_TYPES) {
        expect(types.filter((t) => t === type)).toHaveLength(ITEMS_PER_TYPE)
      }
    }
  })

  it('never repeats a type back to back', () => {
    // Round-robin over a shuffled order, so six matrices in a row is impossible.
    for (const token of TOKENS) {
      const types = planTypes(token)
      for (let i = 1; i < types.length; i++) {
        expect(types[i]).not.toBe(types[i - 1])
      }
    }
  })

  it('is stable for one token and different across tokens', () => {
    expect(planTypes('a3f1')).toEqual(planTypes('a3f1'))
    const orders = new Set(TOKENS.map((t) => planTypes(t).slice(0, 4).join(',')))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('gives every position its own seed', () => {
    const seeds = Array.from({ length: TOTAL_ITEMS }, (_, i) => seedFor('a3f1', i))
    expect(new Set(seeds).size).toBe(TOTAL_ITEMS)
    expect(seedFor('a3f1', 0)).toBe(seedFor('a3f1', 0))
    expect(seedFor('a3f1', 0)).not.toBe(seedFor('b7c2', 0))
  })
})

describe('the ladder', () => {
  it('steps up on right and down on wrong', () => {
    expect(nextLevel(3, true)).toBe(4)
    expect(nextLevel(3, false)).toBe(2)
  })

  it('clamps at both ends rather than running off', () => {
    expect(nextLevel(MAX_LEVEL as Level, true)).toBe(MAX_LEVEL)
    expect(nextLevel(MIN_LEVEL as Level, false)).toBe(MIN_LEVEL)
  })

  it('starts at START_LEVEL with no history', () => {
    expect(levelAfter([])).toBe(START_LEVEL)
  })

  it('reaches the top level on a perfect run of six', () => {
    // 2 -> 3 -> 4 -> 5 -> 6 -> 6, so the last item of a type is at level 6.
    expect(levelAfter([true, true, true, true])).toBe(MAX_LEVEL)
    expect(levelAfter(Array(ITEMS_PER_TYPE).fill(true))).toBe(MAX_LEVEL)
  })

  it('bottoms out at level 1 on an all-wrong run', () => {
    expect(levelAfter(Array(ITEMS_PER_TYPE).fill(false))).toBe(MIN_LEVEL)
  })

  it('stays inside the level range for every mix of answers', () => {
    // All 2^6 answer patterns for one type.
    for (let mask = 0; mask < 1 << ITEMS_PER_TYPE; mask++) {
      const answers = Array.from({ length: ITEMS_PER_TYPE }, (_, i) => Boolean(mask & (1 << i)))
      for (let n = 0; n <= ITEMS_PER_TYPE; n++) {
        const level = levelAfter(answers.slice(0, n))
        expect(level).toBeGreaterThanOrEqual(MIN_LEVEL)
        expect(level).toBeLessThanOrEqual(MAX_LEVEL)
      }
    }
  })

  it('replays to the same level from the same answers', () => {
    const answers = [true, false, true, true, false]
    expect(levelAfter(answers)).toBe(levelAfter([...answers]))
  })
})

describe('a whole paper is reproducible', () => {
  it('regenerates every item identically from (type, level, seed)', () => {
    // This is the promise a reload mid-test depends on, and the reason nothing
    // needs storing but three columns.
    for (const token of TOKENS.slice(0, 2)) {
      const types = planTypes(token)
      const seen: Record<string, boolean[]> = {}

      for (let position = 0; position < TOTAL_ITEMS; position++) {
        const type = types[position]
        const level = levelAfter(seen[type] ?? [])
        const seed = seedFor(token, position)

        const first = generateItem(type, level, seed)
        const second = generateItem(type, level, seed)
        expect(second).toEqual(first)
        expect(validateItem(first)).toBeNull()

        // Walk the ladder as though the child got everything right, which is the
        // path that visits the hardest levels.
        seen[type] = [...(seen[type] ?? []), true]
      }
    }
  })
})

describe('age band', () => {
  it('accepts only the known bands', () => {
    for (const band of AGE_BANDS) expect(isAgeBand(band)).toBe(true)
    expect(isAgeBand('year-5')).toBe(false)
    expect(isAgeBand('')).toBe(false)
    expect(isAgeBand(undefined)).toBe(false)
    expect(isAgeBand(9)).toBe(false)
  })

  it('has no band that could hold a date of birth', () => {
    // Bands only. Scope §10 forbids a date of birth anywhere in this feature.
    for (const band of AGE_BANDS) {
      expect(band).not.toMatch(/\d{4}/)
    }
  })
})
