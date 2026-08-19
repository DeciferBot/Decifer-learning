/**
 * Skills Check planning tests — guards lib/skills-check/plan.ts.
 *
 * The riskiest thing this module does is match a strand to its counterpart in
 * another year by title. A wrong match would report a child as "working below
 * Year 4 fractions" on the strength of a Year 3 geometry question, so the
 * matching tests below are the important ones.
 *
 * Pure functions, no DB/network.
 */

import { describe, it, expect } from 'vitest'
import {
  titleTokens,
  titleSimilarity,
  findCounterpart,
  takeSpreadAcrossTiers,
  planCheck,
  poolSize,
  isSuitableForPublicCheck,
  STRAND_BAND_PLAN,
  STRANDS_PER_CHECK,
  ITEMS_PER_STRAND,
  type TopicPool,
} from '../lib/skills-check/plan'

/** Build a pool with `n` ids per tier, prefixed so ids are traceable in failures. */
function pool(topicId: string, title: string, counts: [number, number, number]): TopicPool {
  const make = (tier: string, n: number) =>
    Array.from({ length: n }, (_, i) => `${topicId}-${tier}-${i}`)
  return {
    topicId,
    title,
    byTier: {
      sprout: make('sprout', counts[0]),
      explorer: make('explorer', counts[1]),
      lightning: make('lightning', counts[2]),
    },
  }
}

describe('titleTokens', () => {
  it('drops the prefixes that appear on half the maths topics', () => {
    expect([...titleTokens('Number: Multiplication and Division')].sort()).toEqual([
      'division',
      'multiplication',
    ])
    expect([...titleTokens('Multiplication and Division')].sort()).toEqual([
      'division',
      'multiplication',
    ])
  })

  it('strips digits, punctuation and year labels', () => {
    expect([...titleTokens('Year 4 Fractions and Decimals')].sort()).toEqual([
      'decimals',
      'fractions',
    ])
  })
})

describe('titleSimilarity', () => {
  it('scores the same strand across years as identical', () => {
    expect(
      titleSimilarity('Number: Multiplication and Division', 'Multiplication and Division'),
    ).toBe(1)
  })

  it('scores different strands low', () => {
    expect(titleSimilarity('Number: Fractions', 'Number and Place Value')).toBe(0)
    expect(
      titleSimilarity('Geometry: Properties of Shapes', 'Measurement: Time'),
    ).toBeLessThan(0.5)
  })

  it('scores a partial overlap between 0 and 1', () => {
    const s = titleSimilarity('Fractions, Decimals and Percentages', 'Fractions and Decimals')
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })
})

describe('findCounterpart', () => {
  const y3 = [
    pool('y3-frac', 'Number: Fractions', [5, 5, 5]),
    pool('y3-md', 'Number: Multiplication and Division', [5, 5, 5]),
    pool('y3-geo', 'Geometry: Properties of Shapes', [5, 5, 5]),
  ]

  it('pairs a strand with the same strand a year below', () => {
    expect(findCounterpart('Multiplication and Division', y3)?.topicId).toBe('y3-md')
  })

  it('refuses a weak match rather than pairing unrelated strands', () => {
    // Nothing in Year 3 is algebra, so there is no honest counterpart.
    expect(findCounterpart('Algebra', y3)).toBeNull()
  })

  it('returns null against an empty year (Year 1 has no year below)', () => {
    expect(findCounterpart('Number: Fractions', [])).toBeNull()
  })

  it('is deterministic on ties', () => {
    const tied = [pool('a', 'Fractions', [1, 0, 0]), pool('b', 'Fractions', [1, 0, 0])]
    expect(findCounterpart('Fractions', tied)?.topicId).toBe('a')
    expect(findCounterpart('Fractions', tied)?.topicId).toBe('a')
  })
})

describe('takeSpreadAcrossTiers', () => {
  it('takes one of each tier when asked for three', () => {
    const p = pool('t', 'Fractions', [3, 3, 3])
    const ids = takeSpreadAcrossTiers(p, 3)
    expect(ids).toHaveLength(3)
    expect(ids.some((i) => i.includes('sprout'))).toBe(true)
    expect(ids.some((i) => i.includes('explorer'))).toBe(true)
    expect(ids.some((i) => i.includes('lightning'))).toBe(true)
  })

  it('never repeats a question', () => {
    const p = pool('t', 'Fractions', [2, 2, 2])
    const ids = takeSpreadAcrossTiers(p, 6)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns what it can when the pool is smaller than asked for', () => {
    const p = pool('t', 'Fractions', [1, 0, 0])
    expect(takeSpreadAcrossTiers(p, 5)).toHaveLength(1)
  })

  it('takes the easiest first, so a single item is a sprout', () => {
    const p = pool('t', 'Fractions', [2, 2, 2])
    expect(takeSpreadAcrossTiers(p, 1)[0]).toContain('sprout')
  })

  it('rotates with startIndex so two checks do not use identical items', () => {
    const p = pool('t', 'Fractions', [3, 0, 0])
    expect(takeSpreadAcrossTiers(p, 1, 0)).not.toEqual(takeSpreadAcrossTiers(p, 1, 1))
  })
})

describe('planCheck', () => {
  const atYear = [
    pool('y4-md', 'Multiplication and Division', [8, 4, 3]),
    pool('y4-add', 'Addition and Subtraction', [7, 4, 3]),
    pool('y4-frac', 'Fractions and Decimals', [6, 3, 2]),
    pool('y4-pv', 'Number and Place Value', [5, 3, 2]),
    pool('y4-stats', 'Statistics', [4, 2, 1]),
    pool('y4-thin', 'Roman Numerals', [1, 0, 0]),
  ]
  const belowYear = [
    pool('y3-md', 'Number: Multiplication and Division', [5, 3, 2]),
    pool('y3-add', 'Number: Addition and Subtraction', [5, 3, 2]),
    pool('y3-frac', 'Number: Fractions', [5, 3, 2]),
    pool('y3-pv', 'Number: Place Value', [5, 3, 2]),
  ]
  const aboveYear = [
    pool('y5-md', 'Multiplication and Division', [5, 3, 2]),
    pool('y5-add', 'Addition and Subtraction', [5, 3, 2]),
    pool('y5-frac', 'Fractions, Decimals and Percentages', [5, 3, 2]),
    pool('y5-pv', 'Number and Place Value', [5, 3, 2]),
  ]

  const plan = planCheck({ atYear, belowYear, aboveYear })

  it('builds exactly 4 strands of 5 items', () => {
    expect(plan.strands).toHaveLength(STRANDS_PER_CHECK)
    expect(plan.items).toHaveLength(STRANDS_PER_CHECK * ITEMS_PER_STRAND)
    for (const s of plan.strands) expect(s.items).toHaveLength(ITEMS_PER_STRAND)
  })

  it('gives every strand the planned band mix', () => {
    for (const s of plan.strands) {
      expect(s.items.map((i) => i.band)).toEqual(STRAND_BAND_PLAN)
    }
  })

  it('numbers positions 0..19 with no gaps or repeats', () => {
    expect(plan.items.map((i) => i.position)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    )
  })

  it('never uses the same question twice in one check', () => {
    const ids = plan.items.map((i) => i.questionId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('picks the deepest pools as strands and says why it skipped the rest', () => {
    expect(plan.strands.map((s) => s.strandTopicId)).toEqual([
      'y4-md',
      'y4-add',
      'y4-frac',
      'y4-pv',
    ])
    expect(plan.skipped.find((s) => s.title === 'Roman Numerals')?.reason).toContain('published')
  })

  it('draws the below and above items from the matching strand, not any old topic', () => {
    const md = plan.strands[0]
    expect(md.items.find((i) => i.band === 'below')?.questionId).toContain('y3-md')
    expect(md.items.find((i) => i.band === 'above')?.questionId).toContain('y5-md')
  })

  it('marks a strand complete when both counterparts were found', () => {
    for (const s of plan.strands) expect(s.incomplete).toBe(false)
  })

  it('is deterministic — the same pools always give the same plan', () => {
    expect(planCheck({ atYear, belowYear, aboveYear })).toEqual(plan)
  })

  it('does not give all four strands the same first question', () => {
    const firsts = plan.strands.map((s) => s.items[0].questionId)
    expect(new Set(firsts).size).toBe(firsts.length)
  })
})

describe('planCheck — edge years', () => {
  const atYear = [
    pool('y1-count', 'Counting to 20', [6, 4, 3]),
    pool('y1-add', 'Addition and Subtraction', [6, 4, 3]),
    pool('y1-shape', 'Shapes', [6, 4, 3]),
    pool('y1-measure', 'Measurement', [6, 4, 3]),
  ]

  it('Year 1 (no year below) still returns a full-length check', () => {
    const plan = planCheck({ atYear, belowYear: [], aboveYear: [pool('y2-add', 'Addition and Subtraction', [3, 2, 1])] })
    expect(plan.items).toHaveLength(20)
    // The missing band is backfilled with at-year items, and never faked as 'below'.
    expect(plan.items.some((i) => i.band === 'below')).toBe(false)
  })

  it('the top year (no year above) still returns a full-length check', () => {
    const plan = planCheck({ atYear, belowYear: [pool('y0-add', 'Addition and Subtraction', [3, 2, 1])], aboveYear: [] })
    expect(plan.items).toHaveLength(20)
    expect(plan.items.some((i) => i.band === 'above')).toBe(false)
  })

  it('flags a strand as incomplete when a counterpart was missing', () => {
    const plan = planCheck({ atYear, belowYear: [], aboveYear: [] })
    for (const s of plan.strands) expect(s.incomplete).toBe(true)
  })

  it('returns fewer strands rather than padding when there are not enough topics', () => {
    const plan = planCheck({ atYear: atYear.slice(0, 2), belowYear: [], aboveYear: [] })
    expect(plan.strands).toHaveLength(2)
    expect(plan.items).toHaveLength(10)
  })
})

describe('planCheck — strand ranking prefers a curriculum thread over a deep pool', () => {
  // Straight from the live Year 4 Maths bank: "Geometry: Position and Direction"
  // has 74 published questions and no counterpart in Year 3, so depth alone put
  // it in the check ahead of core strands. It must lose to a thread the
  // curriculum actually carries across years.
  const atYear = [
    pool('y4-posdir', 'Geometry: Position and Direction', [40, 20, 14]), // deep, orphaned
    pool('y4-md', 'Multiplication and Division', [5, 3, 2]),
    pool('y4-add', 'Addition and Subtraction', [5, 3, 2]),
    pool('y4-frac', 'Fractions and Decimals', [5, 3, 2]),
    pool('y4-measure', 'Measurement', [5, 3, 2]),
  ]
  const neighbours = [
    pool('md', 'Multiplication and Division', [3, 2, 1]),
    pool('add', 'Addition and Subtraction', [3, 2, 1]),
    pool('frac', 'Fractions and Decimals', [3, 2, 1]),
    pool('measure', 'Measurement', [3, 2, 1]),
  ]

  it('drops the deep orphan strand in favour of complete ones', () => {
    const plan = planCheck({ atYear, belowYear: neighbours, aboveYear: neighbours })
    expect(plan.strands.map((s) => s.strandTopicId)).not.toContain('y4-posdir')
    expect(plan.skipped.map((s) => s.title)).toContain('Geometry: Position and Direction')
    for (const s of plan.strands) expect(s.incomplete).toBe(false)
  })

  it('still uses pool depth to break ties between equally complete strands', () => {
    const deepFirst = [
      pool('shallow', 'Measurement', [3, 0, 0]),
      pool('deep', 'Multiplication and Division', [9, 5, 4]),
    ]
    const plan = planCheck(
      { atYear: deepFirst, belowYear: neighbours, aboveYear: neighbours },
      1,
    )
    expect(plan.strands[0].strandTopicId).toBe('deep')
  })

  it('does not penalise a strand for a neighbouring year that does not exist', () => {
    // Year 1: nothing can have a year-below counterpart, so depth decides.
    const plan = planCheck({ atYear, belowYear: [], aboveYear: [] }, 1)
    expect(plan.strands[0].strandTopicId).toBe('y4-posdir')
  })
})

describe('isSuitableForPublicCheck', () => {
  it('rejects suffering used as arithmetic dressing', () => {
    expect(
      isSuitableForPublicCheck(
        'Nazi Germany invaded the Soviet Union in June 1941. By 1943 the Soviets had pushed them back 20 miles a week.',
      ),
    ).toBe(false)
    expect(isSuitableForPublicCheck('A plantation had 240 slaves. How many were there after 60 left?')).toBe(false)
    expect(isSuitableForPublicCheck('In the battle, 1,200 soldiers were killed. How many remained?')).toBe(false)
  })

  it('keeps ordinary questions', () => {
    expect(isSuitableForPublicCheck('A baker makes 9 batches of 6 cookies. How many cookies?')).toBe(true)
    expect(isSuitableForPublicCheck('What is 1/4 of 20?')).toBe(true)
    expect(
      isSuitableForPublicCheck('The Great Fire of London happened in 1666. How many years ago was that?'),
    ).toBe(true)
  })

  it('matches whole words only, so innocent words survive', () => {
    // 'war' inside 'toward', 'died' inside 'studied', 'kill' inside 'skill'.
    expect(isSuitableForPublicCheck('Ravi walks toward the shop. He studied his skill chart.')).toBe(true)
    expect(isSuitableForPublicCheck('The Warwick bus leaves at 3pm.')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(isSuitableForPublicCheck('The WAR lasted 4 years.')).toBe(false)
  })
})

describe('poolSize', () => {
  it('counts every tier', () => {
    expect(poolSize(pool('t', 'x', [2, 3, 4]))).toBe(9)
  })
})
