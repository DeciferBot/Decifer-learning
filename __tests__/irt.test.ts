/**
 * IRT (Rasch / 1-PL) calibration tests — guards lib/irt.ts, the math core of the
 * difficulty-calibration closed loop.
 *
 * Pure functions, no DB/network.
 */

import { describe, it, expect } from 'vitest'
import {
  difficultyFromResponses,
  abilityFromResponses,
  expectedCorrectness,
  recommendTier,
  rankByTargetDifficulty,
  MIN_CALIBRATION_N,
  LOGIT_CLAMP,
} from '../lib/irt'

describe('difficultyFromResponses', () => {
  it('returns null below the minimum sample size (trusts no noise)', () => {
    expect(difficultyFromResponses({ correct: 5, total: MIN_CALIBRATION_N - 1 })).toBeNull()
  })

  it('calibrates an item once it has enough responses', () => {
    const b = difficultyFromResponses({ correct: 10, total: 20 })
    expect(b).not.toBeNull()
    // ~50% correct → difficulty near 0.
    expect(Math.abs(b as number)).toBeLessThan(0.3)
  })

  it('assigns HIGHER difficulty to items more children get wrong', () => {
    const easy = difficultyFromResponses({ correct: 45, total: 50 }) as number // 90% correct
    const hard = difficultyFromResponses({ correct: 5, total: 50 }) as number // 10% correct
    expect(hard).toBeGreaterThan(easy)
  })

  it('never produces ±Infinity even at 0% or 100% correct (Laplace smoothing)', () => {
    const allWrong = difficultyFromResponses({ correct: 0, total: 50 }) as number
    const allRight = difficultyFromResponses({ correct: 50, total: 50 }) as number
    expect(Number.isFinite(allWrong)).toBe(true)
    expect(Number.isFinite(allRight)).toBe(true)
    expect(allWrong).toBeLessThanOrEqual(LOGIT_CLAMP)
    expect(allRight).toBeGreaterThanOrEqual(-LOGIT_CLAMP)
  })

  it('rejects impossible inputs (correct > total) defensively', () => {
    expect(difficultyFromResponses({ correct: 60, total: 50 })).toBeNull()
    expect(difficultyFromResponses({ correct: NaN, total: 50 })).toBeNull()
  })
})

describe('abilityFromResponses', () => {
  it('returns the neutral prior (0) with no history', () => {
    expect(abilityFromResponses([])).toBe(0)
  })

  it('estimates higher ability for a child who answers hard items correctly', () => {
    const strong = abilityFromResponses([
      { difficulty_b: 1.5, correct: true },
      { difficulty_b: 1.0, correct: true },
      { difficulty_b: 2.0, correct: true },
    ])
    const weak = abilityFromResponses([
      { difficulty_b: 1.5, correct: false },
      { difficulty_b: 1.0, correct: false },
      { difficulty_b: 2.0, correct: false },
    ])
    expect(strong).toBeGreaterThan(weak)
  })

  it('ignores uncalibrated items for the difficulty anchor but still counts them for success rate', () => {
    const theta = abilityFromResponses([
      { difficulty_b: null, correct: true },
      { difficulty_b: null, correct: true },
    ])
    // No difficulty anchor → meanB 0; high success rate → positive ability.
    expect(theta).toBeGreaterThan(0)
  })

  it('stays within the clamp range', () => {
    const theta = abilityFromResponses(
      Array.from({ length: 30 }, () => ({ difficulty_b: 3.9, correct: true })),
    )
    expect(theta).toBeLessThanOrEqual(LOGIT_CLAMP)
  })
})

describe('expectedCorrectness', () => {
  it('is 0.5 when ability equals difficulty', () => {
    expect(expectedCorrectness(0, 0)).toBeCloseTo(0.5, 10)
    expect(expectedCorrectness(1.3, 1.3)).toBeCloseTo(0.5, 10)
  })

  it('rises as ability exceeds difficulty and falls as it lags', () => {
    expect(expectedCorrectness(2, 0)).toBeGreaterThan(0.5)
    expect(expectedCorrectness(-2, 0)).toBeLessThan(0.5)
  })
})

describe('recommendTier', () => {
  it('maps the difficulty bands to tiers', () => {
    expect(recommendTier(-2)).toBe('sprout')
    expect(recommendTier(0)).toBe('explorer')
    expect(recommendTier(2)).toBe('lightning')
  })

  it('is monotonic across the band boundaries', () => {
    const order = { sprout: 0, explorer: 1, lightning: 2 }
    let prev = -Infinity
    for (const b of [-3, -1, -0.5, 0.5, 1.5, 3]) {
      const t = order[recommendTier(b)]
      expect(t).toBeGreaterThanOrEqual(prev)
      prev = t
    }
  })
})

describe('rankByTargetDifficulty', () => {
  it('puts items nearest the learner ability (slightly stretched) first', () => {
    const items = [
      { id: 'far-easy', difficulty_b: -3 },
      { id: 'near', difficulty_b: 1.2 },
      { id: 'far-hard', difficulty_b: 3.5 },
    ]
    const ranked = rankByTargetDifficulty(items, 1.0) // target ≈ 1.2
    expect(ranked[0].id).toBe('near')
  })

  it('sorts uncalibrated items last but never drops them', () => {
    const items = [
      { id: 'uncal', difficulty_b: null },
      { id: 'cal', difficulty_b: 0.5 },
    ]
    const ranked = rankByTargetDifficulty(items, 0.3)
    expect(ranked[0].id).toBe('cal')
    expect(ranked.map((i) => i.id)).toContain('uncal')
    expect(ranked.length).toBe(2)
  })

  it('is stable for equal distances (preserves input order)', () => {
    const items = [
      { id: 'a', difficulty_b: 0 },
      { id: 'b', difficulty_b: 0 },
      { id: 'c', difficulty_b: 0 },
    ]
    const ranked = rankByTargetDifficulty(items, 5)
    expect(ranked.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})
