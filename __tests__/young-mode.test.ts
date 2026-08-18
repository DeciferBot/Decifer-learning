/**
 * isYoungBand tests — this boolean decides whether a child gets the KS1
 * visual quiz mode (big type, picture answers, read-aloud, guardrail retry)
 * or the standard experience. Pins the year-3/year-4 boundary, since that's
 * the one place a silent edit would be easy to miss.
 */

import { describe, it, expect } from 'vitest'
import { isYoungBand } from '../lib/quiz/young-mode'

describe('isYoungBand', () => {
  it('is true for year-1 through year-3', () => {
    expect(isYoungBand('year-1')).toBe(true)
    expect(isYoungBand('year-2')).toBe(true)
    expect(isYoungBand('year-3')).toBe(true)
  })

  it('is false from year-4 up', () => {
    expect(isYoungBand('year-4')).toBe(false)
    expect(isYoungBand('year-7')).toBe(false)
    expect(isYoungBand('year-11')).toBe(false)
  })

  it('is false for null, undefined, or an unrecognised label', () => {
    expect(isYoungBand(null)).toBe(false)
    expect(isYoungBand(undefined)).toBe(false)
    expect(isYoungBand('')).toBe(false)
    expect(isYoungBand('reception')).toBe(false)
  })
})
