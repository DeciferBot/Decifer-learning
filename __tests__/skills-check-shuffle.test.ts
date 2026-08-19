/**
 * Skills Check option-building tests — guards lib/skills-check/shuffle.ts.
 *
 * This module takes `quiz_questions.distractors`, which is untyped JSON written
 * by a content pipeline, and turns it into buttons a child presses. So the
 * interesting tests are the malformed ones: nulls, numbers, objects, duplicates
 * and empties all live in that column somewhere across 8,277 rows.
 *
 * Pure functions, no DB/network.
 */

import { describe, it, expect } from 'vitest'
import {
  buildOptions,
  isCorrectAnswer,
  normaliseAnswer,
  seededShuffle,
  MIN_OPTIONS,
} from '../lib/skills-check/shuffle'

describe('buildOptions — well-formed input', () => {
  it('returns the correct answer plus every distractor', () => {
    const opts = buildOptions('4', ['3', '5', '6'], 'seed')
    expect(opts).toHaveLength(4)
    expect(opts.sort()).toEqual(['3', '4', '5', '6'])
  })

  it('shuffles, so the correct answer is not always first', () => {
    const positions = new Set(
      Array.from({ length: 40 }, (_, i) =>
        buildOptions('4', ['3', '5', '6'], `s${i}`).indexOf('4'),
      ),
    )
    expect(positions.size).toBeGreaterThan(1)
  })

  it('gives the same order for the same seed, so a reload does not reshuffle', () => {
    const a = buildOptions('4', ['3', '5', '6'], 'stable')
    const b = buildOptions('4', ['3', '5', '6'], 'stable')
    expect(b).toEqual(a)
  })

  it('gives different orders to different children', () => {
    const a = buildOptions('4', ['3', '5', '6'], 'child-a')
    const b = buildOptions('4', ['3', '5', '6'], 'child-b')
    // Not guaranteed different for any one pair, but across a run it must vary.
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) => buildOptions('4', ['3', '5', '6'], `c${i}`).join('|')),
    )
    expect(orders.size).toBeGreaterThan(1)
    expect([a, b].every((o) => o.length === 4)).toBe(true)
  })
})

describe('buildOptions — malformed distractors from the JSON column', () => {
  it('survives null and undefined', () => {
    expect(buildOptions('4', null, 's')).toEqual(['4'])
    expect(buildOptions('4', undefined, 's')).toEqual(['4'])
  })

  it('survives a non-array', () => {
    expect(buildOptions('4', { a: '3' }, 's')).toEqual(['4'])
    expect(buildOptions('4', '3,5,6', 's')).toEqual(['4'])
  })

  it('coerces numbers, which the pipeline does write', () => {
    const opts = buildOptions('4', [3, 5, 6], 's')
    expect(opts.sort()).toEqual(['3', '4', '5', '6'])
  })

  it('drops nulls, objects and blank strings rather than rendering them', () => {
    const opts = buildOptions('4', ['3', null, { x: 1 }, '', '   ', '5'], 's')
    expect(opts.sort()).toEqual(['3', '4', '5'])
    expect(opts.join(' ')).not.toContain('object')
    expect(opts.join(' ')).not.toContain('null')
  })

  it('drops a distractor that repeats the correct answer', () => {
    // Two identical buttons, one marked right and one wrong, is the worst
    // possible outcome for a child.
    const opts = buildOptions('4', ['4', '5', '6'], 's')
    expect(opts.filter((o) => o === '4')).toHaveLength(1)
    expect(opts).toHaveLength(3)
  })

  it('treats a distractor that differs only by case or spacing as the same answer', () => {
    expect(buildOptions('Paris', ['  paris ', 'Rome', 'Madrid'], 's').sort()).toEqual([
      'Madrid',
      'Paris',
      'Rome',
    ])
  })

  it('drops distractors that repeat each other', () => {
    expect(buildOptions('4', ['3', '3', '5'], 's')).toHaveLength(3)
  })

  it('trims whitespace off what it keeps', () => {
    expect(buildOptions('4', ['  3  '], 's')).toContain('3')
  })
})

describe('MIN_OPTIONS as the fairness gate', () => {
  it('is 4: one correct answer and three distractors', () => {
    expect(MIN_OPTIONS).toBe(4)
  })

  it('a well-formed question clears it', () => {
    expect(buildOptions('4', ['3', '5', '6'], 's').length).toBeGreaterThanOrEqual(MIN_OPTIONS)
  })

  it('the broken shapes all fall short of it, so they get filtered at build time', () => {
    for (const bad of [null, [], ['3'], ['4', '4'], [null, ''], 'nonsense']) {
      expect(buildOptions('4', bad, 's').length).toBeLessThan(MIN_OPTIONS)
    }
  })
})

describe('isCorrectAnswer', () => {
  it('matches an exact answer', () => {
    expect(isCorrectAnswer('4', '4')).toBe(true)
  })

  it('ignores case and surrounding or repeated whitespace', () => {
    expect(isCorrectAnswer(' Paris ', 'paris')).toBe(true)
    expect(isCorrectAnswer('a  b', 'a b')).toBe(true)
  })

  it('counts a missing answer as wrong, never as absent', () => {
    // An unanswered question must score as wrong. Skipping the hard ones would
    // otherwise read as "secure".
    expect(isCorrectAnswer(null, '4')).toBe(false)
    expect(isCorrectAnswer(undefined, '4')).toBe(false)
    expect(isCorrectAnswer('', '4')).toBe(false)
  })

  it('does not match a different answer', () => {
    expect(isCorrectAnswer('5', '4')).toBe(false)
    expect(isCorrectAnswer('44', '4')).toBe(false)
  })
})

describe('normaliseAnswer', () => {
  it('lowercases, trims, and collapses runs of whitespace', () => {
    expect(normaliseAnswer('  The   Big  Cat ')).toBe('the big cat')
  })
})

describe('seededShuffle', () => {
  it('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(seededShuffle(input, 's').sort((a, b) => a - b)).toEqual(input)
  })

  it('never mutates its input', () => {
    const input = ['a', 'b', 'c', 'd']
    const copy = [...input]
    seededShuffle(input, 's')
    expect(input).toEqual(copy)
  })

  it('handles empty and single-element arrays', () => {
    expect(seededShuffle([], 's')).toEqual([])
    expect(seededShuffle(['only'], 's')).toEqual(['only'])
  })
})
