/**
 * pickLine tests — this decides what the study buddy says after every
 * answer in QuizShell. The one behaviour worth pinning: it must never repeat
 * the line the child just saw twice running (copy audit finding: the old
 * static "Correct! Full marks!" landing five times in one round), and it
 * must never return something outside the pool.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { pickLine } from '../lib/buddy-lines'

describe('pickLine', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the only line in a single-item pool regardless of avoid', () => {
    expect(pickLine(['only one'])).toBe('only one')
    expect(pickLine(['only one'], 'only one')).toBe('only one')
  })

  it('never returns the avoided line when alternatives exist', () => {
    const pool = ['a', 'b', 'c'] as const
    for (let i = 0; i < 50; i++) {
      const line = pickLine(pool, 'a')
      expect(line).not.toBe('a')
      expect(pool).toContain(line)
    }
  })

  it('picks the filtered-pool line at the mocked random index', () => {
    const pool = ['a', 'b', 'c']
    // With 'a' avoided, the filtered pool is ['b', 'c']; random() -> 0.99
    // should select the last entry, index 1 -> 'c'.
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    expect(pickLine(pool, 'a')).toBe('c')
  })

  it('can repeat the avoided line only when it is the sole remaining option', () => {
    expect(pickLine(['x', 'y'], 'x')).toBe('y')
    // Both entries equal — filtering removes everything, falls back to pool[0].
    expect(pickLine(['x', 'x'], 'x')).toBe('x')
  })
})
