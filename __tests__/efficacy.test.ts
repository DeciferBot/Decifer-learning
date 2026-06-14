/**
 * Learning-efficacy analytics tests — guards lib/efficacy.ts, the first-party
 * measurement of whether children actually learn (the metric that defines a
 * world-class ed-tech system).
 *
 * Pure functions, no DB/network.
 */

import { describe, it, expect } from 'vitest'
import {
  computeTopicMastery,
  computeRetention,
  summariseEfficacy,
  efficacyReport,
  MASTERY_THRESHOLD,
  RETENTION_GAP_DAYS,
  type AttemptInput,
} from '../lib/efficacy'

const T0 = new Date('2026-06-01T10:00:00Z')
function days(n: number) {
  return new Date(T0.getTime() + n * 24 * 60 * 60 * 1000)
}
function attempt(over: Partial<AttemptInput> = {}): AttemptInput {
  return { profileId: 'c1', topicId: 't1', score: 0.5, createdAt: T0, ...over }
}

describe('computeTopicMastery', () => {
  it('captures first/latest/best and a positive normalised gain', () => {
    const [m] = computeTopicMastery([
      attempt({ score: 0.4, createdAt: days(0) }),
      attempt({ score: 0.6, createdAt: days(1) }),
      attempt({ score: 0.8, createdAt: days(2) }),
    ])
    expect(m.firstScore).toBe(0.4)
    expect(m.latestScore).toBe(0.8)
    expect(m.bestScore).toBe(0.8)
    expect(m.delta).toBeCloseTo(0.4, 10)
    // Hake g = (0.8 - 0.4) / (1 - 0.4) = 0.666…
    expect(m.normalisedGain).toBeCloseTo(0.4 / 0.6, 10)
    expect(m.mastered).toBe(true)
  })

  it('orders attempts chronologically regardless of input order', () => {
    const [m] = computeTopicMastery([
      attempt({ score: 0.9, createdAt: days(2) }),
      attempt({ score: 0.3, createdAt: days(0) }),
      attempt({ score: 0.5, createdAt: days(1) }),
    ])
    expect(m.firstScore).toBe(0.3)
    expect(m.latestScore).toBe(0.9)
  })

  it('records attempts and days to first mastery, not best', () => {
    const [m] = computeTopicMastery([
      attempt({ score: 0.5, createdAt: days(0) }),
      attempt({ score: 0.72, createdAt: days(2) }), // first pass
      attempt({ score: 0.95, createdAt: days(5) }),
    ])
    expect(m.attemptsToMastery).toBe(2)
    expect(m.daysToMastery).toBeCloseTo(2, 10)
  })

  it('leaves mastery markers null when the child never reaches threshold', () => {
    const [m] = computeTopicMastery([
      attempt({ score: 0.3 }),
      attempt({ score: 0.5, createdAt: days(1) }),
    ])
    expect(m.mastered).toBe(false)
    expect(m.attemptsToMastery).toBeNull()
    expect(m.daysToMastery).toBeNull()
  })

  it('returns null normalised gain when there is no headroom (pre === 1)', () => {
    const [m] = computeTopicMastery([
      attempt({ score: 1, createdAt: days(0) }),
      attempt({ score: 1, createdAt: days(1) }),
    ])
    expect(m.normalisedGain).toBeNull()
  })

  it('separates records per child and per topic', () => {
    const records = computeTopicMastery([
      attempt({ profileId: 'c1', topicId: 't1' }),
      attempt({ profileId: 'c1', topicId: 't2' }),
      attempt({ profileId: 'c2', topicId: 't1' }),
    ])
    expect(records.length).toBe(3)
  })
})

describe('computeRetention', () => {
  it('counts a spaced re-attempt that still passes as retained', () => {
    const [r] = computeRetention([
      attempt({ score: 0.8, createdAt: days(0) }), // mastered
      attempt({ score: 0.85, createdAt: days(0 + RETENTION_GAP_DAYS + 1) }), // spaced review, still passing
    ])
    expect(r.retained).toBe(true)
    expect(r.gapDays).toBeGreaterThanOrEqual(RETENTION_GAP_DAYS)
  })

  it('counts a spaced re-attempt that drops below threshold as not retained', () => {
    const [r] = computeRetention([
      attempt({ score: 0.8, createdAt: days(0) }),
      attempt({ score: 0.5, createdAt: days(10) }),
    ])
    expect(r.retained).toBe(false)
  })

  it('ignores re-attempts that are too soon to count as spaced review', () => {
    const records = computeRetention([
      attempt({ score: 0.8, createdAt: days(0) }),
      attempt({ score: 0.9, createdAt: days(1) }), // gap < RETENTION_GAP_DAYS
    ])
    expect(records).toEqual([])
  })

  it('ignores topics that were never mastered', () => {
    expect(
      computeRetention([
        attempt({ score: 0.3, createdAt: days(0) }),
        attempt({ score: 0.4, createdAt: days(10) }),
      ]),
    ).toEqual([])
  })
})

describe('summariseEfficacy / efficacyReport', () => {
  it('aggregates a realistic cohort into a coherent summary', () => {
    const attempts: AttemptInput[] = [
      // c1/t1: 0.4 → 0.9, mastered on 2nd attempt, retained on a spaced review
      attempt({ profileId: 'c1', topicId: 't1', score: 0.4, createdAt: days(0) }),
      attempt({ profileId: 'c1', topicId: 't1', score: 0.9, createdAt: days(1) }),
      attempt({ profileId: 'c1', topicId: 't1', score: 0.8, createdAt: days(6) }),
      // c2/t1: 0.5 → 0.6, never mastered
      attempt({ profileId: 'c2', topicId: 't1', score: 0.5, createdAt: days(0) }),
      attempt({ profileId: 'c2', topicId: 't1', score: 0.6, createdAt: days(2) }),
    ]
    const report = efficacyReport(attempts)
    expect(report.topicsTracked).toBe(2)
    expect(report.childrenTracked).toBe(2)
    expect(report.masteryRate).toBe(0.5)
    expect(report.improvedRate).toBe(1) // both improved (delta > 0)
    expect(report.averageNormalisedGain).toBeGreaterThan(0)
    expect(report.retentionRate).toBe(1)
    expect(report.reviewsTracked).toBe(1)
    expect(report.medianAttemptsToMastery).toBe(2)
  })

  it('reports null retention when no spaced reviews have happened yet', () => {
    const report = efficacyReport([
      attempt({ score: 0.8, createdAt: days(0) }),
      attempt({ score: 0.9, createdAt: days(1) }),
    ])
    expect(report.retentionRate).toBeNull()
    expect(report.reviewsTracked).toBe(0)
  })

  it('handles an empty dataset without throwing', () => {
    const report = efficacyReport([])
    expect(report.topicsTracked).toBe(0)
    expect(report.masteryRate).toBe(0)
    expect(report.averageNormalisedGain).toBeNull()
    expect(report.retentionRate).toBeNull()
  })

  it('uses the documented mastery threshold', () => {
    const justBelow = computeTopicMastery([attempt({ score: MASTERY_THRESHOLD - 0.01 })])
    const atLine = computeTopicMastery([attempt({ score: MASTERY_THRESHOLD })])
    expect(justBelow[0].mastered).toBe(false)
    expect(atLine[0].mastered).toBe(true)
  })
})
