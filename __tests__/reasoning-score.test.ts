/**
 * Scoring and the free teaser.
 *
 * Two things are being defended here. The first is arithmetic: levels, medians
 * and counts. The second is the rule that matters more than any of it — nothing
 * this module produces may look like an IQ score, a percentile, or a comparison
 * with another child (scope §2).
 */

import { describe, it, expect } from 'vitest'
import {
  LEVEL_REACHED_MIN_TYPES,
  MAX_PRACTICE_STEPS,
  PRACTICE,
  buildPracticeSteps,
  buildTeaser,
  formatMs,
  median,
  overallLevelReached,
  scoreReasoning,
  slowestType,
  typeVerdict,
  type AnsweredItem,
  type TypeResult,
} from '@/lib/reasoning/score'
import { REASONING_ITEM_TYPES, type Level, type ReasoningItemType } from '@/lib/reasoning/generate'
import { ITEMS_PER_TYPE } from '@/lib/reasoning/plan'

function answers(
  spec: Partial<Record<ReasoningItemType, { correct: boolean; level: Level; timeMs?: number }[]>>,
): AnsweredItem[] {
  const out: AnsweredItem[] = []
  for (const type of REASONING_ITEM_TYPES) {
    for (const a of spec[type] ?? []) {
      out.push({ type, level: a.level, correct: a.correct, timeMs: a.timeMs ?? null })
    }
  }
  return out
}

/** Six answers of one type, `right` of them correct, climbing the ladder. */
function run(right: number): { correct: boolean; level: Level; timeMs: number }[] {
  return Array.from({ length: ITEMS_PER_TYPE }, (_, i) => ({
    correct: i < right,
    level: (Math.min(6, 2 + i) as Level),
    timeMs: 5000,
  }))
}

describe('median', () => {
  it('is null on nothing', () => {
    expect(median([])).toBeNull()
  })

  it('takes the middle of an odd count', () => {
    expect(median([9, 1, 5])).toBe(5)
  })

  it('averages the two middles of an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(3) // (2 + 3) / 2, rounded
  })

  it('does not mutate its input', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })
})

describe('typeVerdict', () => {
  it('reads 5 and 6 as strong, 3 and 4 as developing, below that as needing practice', () => {
    expect(typeVerdict(6)).toBe('strong')
    expect(typeVerdict(5)).toBe('strong')
    expect(typeVerdict(4)).toBe('developing')
    expect(typeVerdict(3)).toBe('developing')
    expect(typeVerdict(2)).toBe('needs_practice')
    expect(typeVerdict(0)).toBe('needs_practice')
  })

  it('scales the cut points for a short run rather than judging it harshly', () => {
    // 3 of 3 is a clean sweep and must not read as "developing" just because the
    // absolute cut point is 5.
    expect(typeVerdict(3, 3)).toBe('strong')
  })
})

describe('overallLevelReached', () => {
  const at = (levels: number[]): TypeResult[] =>
    levels.map((levelReached, i) => ({
      type: REASONING_ITEM_TYPES[i],
      label: 'x',
      correct: levelReached > 0 ? 1 : 0,
      total: ITEMS_PER_TYPE,
      levelReached,
      medianTimeMs: null,
      verdict: 'developing' as const,
    }))

  it('needs the level in at least two types', () => {
    expect(LEVEL_REACHED_MIN_TYPES).toBe(2)
    // One type at 6 and the rest at 2: a single lucky run must not set the
    // headline. Two types reach 2, so that is the answer.
    expect(overallLevelReached(at([6, 2, 2, 2]))).toBe(2)
  })

  it('takes the highest level two types share', () => {
    expect(overallLevelReached(at([5, 4, 4, 1]))).toBe(4)
    expect(overallLevelReached(at([6, 6, 1, 1]))).toBe(6)
  })

  it('is 0 when nothing was solved anywhere', () => {
    expect(overallLevelReached(at([0, 0, 0, 0]))).toBe(0)
  })

  it('is 0 when only one type solved anything at all', () => {
    expect(overallLevelReached(at([4, 0, 0, 0]))).toBe(0)
  })
})

describe('scoreReasoning', () => {
  it('counts per type and overall', () => {
    const result = scoreReasoning(
      answers({ sequence: run(6), matrix: run(3), analogy: run(0), odd_one_out: run(5) }),
    )
    expect(result.totalItems).toBe(24)
    expect(result.rawScore).toBe(14)
    expect(result.types).toHaveLength(4)
    expect(result.types.map((t) => t.correct)).toEqual([6, 3, 0, 5])
  })

  it('reports the hardest level actually solved, not the hardest attempted', () => {
    // Right on levels 2 and 3, then wrong on 4, 3, 2, 1. Highest correct is 3.
    const spec = [
      { correct: true, level: 2 as Level },
      { correct: true, level: 3 as Level },
      { correct: false, level: 4 as Level },
      { correct: false, level: 3 as Level },
      { correct: false, level: 2 as Level },
      { correct: false, level: 1 as Level },
    ]
    const result = scoreReasoning(answers({ sequence: spec }))
    expect(result.types[0].levelReached).toBe(3)
  })

  it('reports level 0 for a type with nothing right', () => {
    const result = scoreReasoning(answers({ sequence: run(0) }))
    expect(result.types[0].levelReached).toBe(0)
  })

  it('takes the median time per type and ignores missing times', () => {
    const result = scoreReasoning([
      { type: 'sequence', level: 2, correct: true, timeMs: 1000 },
      { type: 'sequence', level: 3, correct: true, timeMs: 9000 },
      { type: 'sequence', level: 4, correct: true, timeMs: 5000 },
      { type: 'sequence', level: 5, correct: true, timeMs: null },
    ])
    expect(result.types[0].medianTimeMs).toBe(5000)
  })

  it('drops a type nobody was asked about rather than reporting it as zero', () => {
    const result = scoreReasoning(answers({ sequence: run(4) }))
    expect(result.types).toHaveLength(1)
    expect(result.types[0].type).toBe('sequence')
  })

  it('returns an empty, safe result for no answers at all', () => {
    const result = scoreReasoning([])
    expect(result.types).toEqual([])
    expect(result.rawScore).toBe(0)
    expect(result.levelReached).toBe(0)
  })

  it('keeps the fixed type order however the answers arrive', () => {
    const shuffled = [
      { type: 'odd_one_out' as const, level: 2 as Level, correct: true, timeMs: null },
      { type: 'sequence' as const, level: 2 as Level, correct: true, timeMs: null },
    ]
    expect(scoreReasoning(shuffled).types.map((t) => t.type)).toEqual(['sequence', 'odd_one_out'])
  })
})

describe('the free teaser', () => {
  it('leads with the level reached out of six', () => {
    const result = scoreReasoning(
      answers({ sequence: run(6), matrix: run(6), analogy: run(2), odd_one_out: run(2) }),
    )
    expect(buildTeaser(result).headline).toBe('Reached level 6 of 6.')
  })

  it('says plainly when there is not enough to place a level', () => {
    const result = scoreReasoning(
      answers({ sequence: run(0), matrix: run(0), analogy: run(0), odd_one_out: run(0) }),
    )
    expect(buildTeaser(result).headline).toBe('Not enough right answers to place a level this time.')
  })

  it('names the strongest type but never the weak ones', () => {
    const result = scoreReasoning(
      answers({ sequence: run(6), matrix: run(1), analogy: run(1), odd_one_out: run(1) }),
    )
    const teaser = buildTeaser(result)
    expect(teaser.strongestLine).toContain('sequences')
    // The gated part is WHICH types need work. The teaser may only count them.
    const gapText = teaser.gapLine.toLowerCase()
    for (const word of ['matrices', 'analogies', 'odd one out']) {
      expect(gapText).not.toContain(word)
    }
    expect(teaser.gapLine).toBe('Three of the four kinds of puzzle need practice.')
  })

  it('reads properly when everything is strong, and when nothing is', () => {
    const allStrong = scoreReasoning(
      answers({ sequence: run(6), matrix: run(6), analogy: run(6), odd_one_out: run(6) }),
    )
    expect(buildTeaser(allStrong).gapLine).toBe('All four kinds of puzzle came out strong.')

    const noneStrong = scoreReasoning(
      answers({ sequence: run(1), matrix: run(1), analogy: run(1), odd_one_out: run(1) }),
    )
    expect(buildTeaser(noneStrong).gapLine).toBe(
      'All four kinds of puzzle would benefit from practice.',
    )
  })

  it('uses the singular for exactly one weak type', () => {
    const result = scoreReasoning(
      answers({ sequence: run(6), matrix: run(6), analogy: run(6), odd_one_out: run(1) }),
    )
    expect(buildTeaser(result).gapLine).toBe('One of the four kinds of puzzle needs practice.')
  })

  it('is the same for the same answers', () => {
    const result = scoreReasoning(
      answers({ sequence: run(4), matrix: run(4), analogy: run(2), odd_one_out: run(5) }),
    )
    expect(buildTeaser(result)).toEqual(buildTeaser(result))
  })

  it('never produces an IQ, a percentile, or a comparison with another child', () => {
    // The one rule in this feature that is not negotiable (scope §2). Checked
    // across a spread of outcomes rather than one.
    const banned = /\b(iq|percentile|standardised|standardized|sas|average|top \d|better than|compared)\b/i
    for (const right of [0, 1, 3, 5, 6]) {
      const result = scoreReasoning(
        answers({
          sequence: run(right),
          matrix: run(right),
          analogy: run(right),
          odd_one_out: run(right),
        }),
      )
      const teaser = buildTeaser(result)
      for (const line of [teaser.headline, teaser.strongestLine, teaser.gapLine]) {
        expect(line).not.toMatch(banned)
      }
    }
  })
})

describe('practice steps', () => {
  it('suggests the weakest types first, capped at three', () => {
    const result = scoreReasoning(
      answers({ sequence: run(6), matrix: run(1), analogy: run(0), odd_one_out: run(3) }),
    )
    const steps = buildPracticeSteps(result)
    expect(steps).toHaveLength(3)
    expect(steps.map((s) => s.type)).toEqual(['analogy', 'matrix', 'odd_one_out'])
    expect(steps.length).toBeLessThanOrEqual(MAX_PRACTICE_STEPS)
  })

  it('suggests nothing when every type is strong', () => {
    const result = scoreReasoning(
      answers({ sequence: run(6), matrix: run(5), analogy: run(6), odd_one_out: run(5) }),
    )
    expect(buildPracticeSteps(result)).toEqual([])
  })

  it('links every type to a real anchor on the non-verbal page', () => {
    for (const type of REASONING_ITEM_TYPES) {
      expect(PRACTICE[type].anchor).toMatch(/^[a-z-]+$/)
      expect(PRACTICE[type].tip.length).toBeGreaterThan(20)
    }
    const result = scoreReasoning(answers({ matrix: run(0) }))
    expect(buildPracticeSteps(result)[0].url).toBe('/reasoning/non-verbal#matrices')
  })
})

describe('formatMs', () => {
  it('shows a decimal under ten seconds and a whole number over', () => {
    expect(formatMs(1400)).toBe('1.4s')
    expect(formatMs(9900)).toBe('9.9s')
    expect(formatMs(12400)).toBe('12s')
  })

  it('shows a dash rather than a fake zero when nothing was timed', () => {
    expect(formatMs(null)).toBe('—')
  })
})

describe('slowestType', () => {
  const t = (type: ReasoningItemType, medianTimeMs: number | null): TypeResult => ({
    type,
    label: type,
    correct: 3,
    total: ITEMS_PER_TYPE,
    levelReached: 3,
    medianTimeMs,
    verdict: 'developing',
  })

  it('names the type that genuinely dragged', () => {
    const slowest = slowestType([
      t('sequence', 4000),
      t('matrix', 9000),
      t('analogy', 4200),
      t('odd_one_out', 3800),
    ])
    expect(slowest?.type).toBe('matrix')
  })

  it('names nobody when the times are all much of a muchness', () => {
    // A perfect run answered at a steady pace produced "slowest: sequences"
    // when all four medians were identical, which is a claim about noise.
    expect(
      slowestType([
        t('sequence', 4000),
        t('matrix', 4000),
        t('analogy', 4000),
        t('odd_one_out', 4000),
      ]),
    ).toBeNull()
    expect(slowestType([t('sequence', 4000), t('matrix', 4600)])).toBeNull()
  })

  it('needs two timed types before it will compare anything', () => {
    expect(slowestType([])).toBeNull()
    expect(slowestType([t('sequence', 4000)])).toBeNull()
    expect(slowestType([t('sequence', 4000), t('matrix', null)])).toBeNull()
  })
})
