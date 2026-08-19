/**
 * Skills Check scoring tests — guards lib/skills-check/score.ts.
 *
 * Every row of the working-level ladder in docs/SKILLS_CHECK_SCOPE.md §5 has a
 * test here, so tuning a cut point fails loudly rather than silently moving
 * where children are placed.
 *
 * Pure functions, no DB/network.
 */

import { describe, it, expect } from 'vitest'
import {
  scoreCheck,
  strandVerdict,
  workingLevelFromAnswers,
  buildTeaser,
  describeWorkingLevel,
  STRAND_ITEM_COUNT,
  type CheckAnswer,
  type ItemBand,
} from '../lib/skills-check/score'

/** Build `n` answers in one band, `correct` of them right, all in one strand. */
function band(
  bandName: ItemBand,
  n: number,
  correct: number,
  strandTopicId = 'strand-1',
  strandTitle = 'Fractions',
): CheckAnswer[] {
  return Array.from({ length: n }, (_, i) => ({
    strandTopicId,
    strandTitle,
    band: bandName,
    correct: i < correct,
  }))
}

/**
 * A standard 20-item check: 4 strands x (1 below, 3 at, 1 above).
 * `atCorrectPerStrand` sets how many of the 3 at-year items each strand gets right.
 */
function standardCheck(opts: {
  belowCorrect: number // out of 4
  atCorrectPerStrand: number[] // length 4, each out of 3
  aboveCorrect: number // out of 4
}): CheckAnswer[] {
  const titles = ['Fractions', 'Place Value', 'Measurement', 'Geometry']
  const answers: CheckAnswer[] = []
  titles.forEach((title, s) => {
    const id = `strand-${s + 1}`
    answers.push(...band('below', 1, s < opts.belowCorrect ? 1 : 0, id, title))
    answers.push(...band('at', 3, opts.atCorrectPerStrand[s], id, title))
    answers.push(...band('above', 1, s < opts.aboveCorrect ? 1 : 0, id, title))
  })
  return answers
}

describe('strandVerdict', () => {
  it('calls 5 of 5 and 4 of 5 secure', () => {
    expect(strandVerdict(5)).toBe('secure')
    expect(strandVerdict(4)).toBe('secure')
  })

  it('calls 3 of 5 developing', () => {
    expect(strandVerdict(3)).toBe('developing')
  })

  it('calls 2 or fewer of 5 needs_work', () => {
    expect(strandVerdict(2)).toBe('needs_work')
    expect(strandVerdict(0)).toBe('needs_work')
  })

  it('scales its cut points for a strand shorter than the standard length', () => {
    // 4 of 4 is proportionally the same as 5 of 5.
    expect(strandVerdict(4, 4)).toBe('secure')
    // 2 of 4 (50%) is below the 60% developing line.
    expect(strandVerdict(2, 4)).toBe('needs_work')
  })

  it('uses the standard strand length by default', () => {
    expect(STRAND_ITEM_COUNT).toBe(5)
  })
})

describe('workingLevelFromAnswers — the ladder', () => {
  it('row 1: weak on year-below items reports below_year, whatever else happened', () => {
    const answers = [
      ...band('below', 4, 1), // 25%, under the 60% line
      ...band('at', 12, 12), // perfect at year
      ...band('above', 4, 4), // perfect above year
    ]
    expect(workingLevelFromAnswers(answers)).toBe('below_year')
  })

  it('row 2: year-below secure but under half the at-year items reports towards_year', () => {
    const answers = [...band('below', 4, 4), ...band('at', 12, 5), ...band('above', 4, 0)]
    expect(workingLevelFromAnswers(answers)).toBe('towards_year')
  })

  it('row 3: at-year between half and 80% reports within_year', () => {
    const answers = [...band('below', 4, 4), ...band('at', 12, 8), ...band('above', 4, 0)]
    expect(workingLevelFromAnswers(answers)).toBe('within_year')
  })

  it('row 4: at-year 80%+ but under half above-year reports secure_year', () => {
    const answers = [...band('below', 4, 4), ...band('at', 12, 10), ...band('above', 4, 1)]
    expect(workingLevelFromAnswers(answers)).toBe('secure_year')
  })

  it('row 5: at-year 80%+ and half the above-year items reports ready to stretch', () => {
    const answers = [...band('below', 4, 4), ...band('at', 12, 10), ...band('above', 4, 2)]
    expect(workingLevelFromAnswers(answers)).toBe('secure_ready_to_stretch')
  })

  it('sits exactly on the boundaries the way the table reads', () => {
    // 60% below-year is a pass, not a fail.
    const onBelowLine = [...band('below', 5, 3), ...band('at', 10, 9), ...band('above', 2, 0)]
    expect(workingLevelFromAnswers(onBelowLine)).toBe('secure_year')
    // Exactly 50% at-year clears "towards" into "within".
    const onAtLine = [...band('below', 4, 4), ...band('at', 12, 6), ...band('above', 4, 0)]
    expect(workingLevelFromAnswers(onAtLine)).toBe('within_year')
  })
})

describe('workingLevelFromAnswers — missing bands', () => {
  it('skips the year-below rule when there are no year-below items (Year 1)', () => {
    // Year 1 has no year below. A strong child must still be able to reach secure.
    const answers = [...band('at', 16, 15), ...band('above', 4, 3)]
    expect(workingLevelFromAnswers(answers)).toBe('secure_ready_to_stretch')
  })

  it('caps at secure_year when there are no year-above items to stretch on', () => {
    const answers = [...band('below', 4, 4), ...band('at', 16, 16)]
    expect(workingLevelFromAnswers(answers)).toBe('secure_year')
  })

  it('reports the cautious level when there is no at-year evidence at all', () => {
    expect(workingLevelFromAnswers([])).toBe('towards_year')
    expect(workingLevelFromAnswers(band('below', 4, 4))).toBe('towards_year')
  })
})

describe('scoreCheck', () => {
  const answers = standardCheck({
    belowCorrect: 4,
    atCorrectPerStrand: [3, 3, 1, 0],
    aboveCorrect: 2,
  })

  it('groups into one result per strand, in first-appearance order', () => {
    const r = scoreCheck(answers)
    expect(r.strands.map((s) => s.strandTitle)).toEqual([
      'Fractions',
      'Place Value',
      'Measurement',
      'Geometry',
    ])
  })

  it('counts every item exactly once', () => {
    const r = scoreCheck(answers)
    expect(r.totalItems).toBe(20)
    expect(r.strands.reduce((n, s) => n + s.total, 0)).toBe(20)
    expect(r.rawScore).toBe(answers.filter((a) => a.correct).length)
  })

  it('gives each strand its own verdict', () => {
    const r = scoreCheck(answers)
    // strand 1: 1 below + 3 at + 1 above = 5 of 5
    expect(r.strands[0].verdict).toBe('secure')
    // strand 3: 1 below + 1 at + 0 above = 2 of 5
    expect(r.strands[2].verdict).toBe('needs_work')
    // strand 4: 1 below + 0 at + 0 above = 1 of 5
    expect(r.strands[3].verdict).toBe('needs_work')
  })

  it('reports per-band accuracy, and null for a band with no items', () => {
    const r = scoreCheck([...band('at', 4, 2)])
    expect(r.bandAccuracy.at).toBe(0.5)
    expect(r.bandAccuracy.below).toBeNull()
    expect(r.bandAccuracy.above).toBeNull()
  })

  it('handles an empty check without throwing', () => {
    const r = scoreCheck([])
    expect(r.strands).toEqual([])
    expect(r.rawScore).toBe(0)
    expect(r.totalItems).toBe(0)
  })
})

describe('buildTeaser — the free part', () => {
  const result = scoreCheck(
    standardCheck({ belowCorrect: 4, atCorrectPerStrand: [3, 3, 1, 0], aboveCorrect: 2 }),
  )
  const teaser = buildTeaser(result, 'Year 4', 'maths')

  it('leads with the working level as one sentence', () => {
    // This fixture gets 7 of 12 at-year items (58%), so it lands in "within".
    expect(teaser.headline).toBe('Working within Year 4 maths.')
  })

  it('names the strongest strand', () => {
    expect(teaser.strongestLine).toBe('Strongest area: Fractions.')
  })

  it('counts what is not secure WITHOUT naming it — that is the gated part', () => {
    expect(teaser.gapLine).toBe('Two of the four areas we checked are not secure yet.')
    expect(teaser.gapLine).not.toContain('Measurement')
    expect(teaser.gapLine).not.toContain('Geometry')
  })

  it('uses singular wording for a single gap', () => {
    const r = scoreCheck(
      standardCheck({ belowCorrect: 4, atCorrectPerStrand: [3, 3, 3, 1], aboveCorrect: 4 }),
    )
    expect(buildTeaser(r, 'Year 4', 'maths').gapLine).toBe(
      'One of the four areas we checked is not secure yet.',
    )
  })

  it('avoids "four of the four" when nothing is secure', () => {
    // The general form produced "Four of the four areas we checked are not
    // secure yet", which a real result page showed up as clumsy.
    const r = scoreCheck(
      standardCheck({ belowCorrect: 0, atCorrectPerStrand: [0, 0, 0, 0], aboveCorrect: 0 }),
    )
    const line = buildTeaser(r, 'Year 4', 'maths').gapLine
    expect(line).toBe('All four areas we checked need work.')
    expect(line).not.toContain('of the four')
  })

  it('says nothing misleading when there were no strands at all', () => {
    const empty = scoreCheck([])
    expect(buildTeaser(empty, 'Year 4', 'maths').gapLine).toBe('Not enough answers to say more.')
  })

  it('says so plainly when everything came out secure', () => {
    const r = scoreCheck(
      standardCheck({ belowCorrect: 4, atCorrectPerStrand: [3, 3, 3, 3], aboveCorrect: 4 }),
    )
    expect(buildTeaser(r, 'Year 4', 'maths').gapLine).toBe(
      'All four areas we checked came out secure.',
    )
  })

  it('is deterministic — the same answers always give the same teaser', () => {
    const again = buildTeaser(result, 'Year 4', 'maths')
    expect(again).toEqual(teaser)
  })

  it('never claims a score, percentile or comparison', () => {
    const text = [teaser.headline, teaser.strongestLine, teaser.gapLine].join(' ').toLowerCase()
    for (const banned of ['iq', 'percentile', 'average', 'rank', 'gifted', 'above other']) {
      expect(text).not.toContain(banned)
    }
  })
})

describe('describeWorkingLevel', () => {
  it('reads as plain English for every level', () => {
    expect(describeWorkingLevel('below_year', 'Year 3', 'maths')).toBe('Working below Year 3 maths')
    expect(describeWorkingLevel('towards_year', 'Year 3', 'maths')).toBe(
      'Working towards Year 3 maths',
    )
    expect(describeWorkingLevel('within_year', 'Year 3', 'maths')).toBe(
      'Working within Year 3 maths',
    )
    expect(describeWorkingLevel('secure_year', 'Year 3', 'maths')).toBe('Secure at Year 3 maths')
    expect(describeWorkingLevel('secure_ready_to_stretch', 'Year 3', 'maths')).toBe(
      'Secure at Year 3 maths, and ready to stretch',
    )
  })
})
