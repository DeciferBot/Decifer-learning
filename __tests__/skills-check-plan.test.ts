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
  questionsAreNearDuplicates,
  strandFamily,
  isSelfContained,
  hasSingleAnswerPhrasing,
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

describe('findCounterpart — the strand-family fallback', () => {
  // English topics are renamed every year, so a full-title match scores near
  // zero. Without this fallback every English check came out with all four
  // strands incomplete, which collapses the whole working-level ladder.
  const y5English = [
    pool('y5-read', 'Reading: Figurative Language and Authorial Choices', [5, 3, 2]),
    pool('y5-spell', 'Spelling: Silent Letters and Etymology', [5, 3, 2]),
    pool('y5-gram', 'Grammar: Relative Clauses', [8, 4, 3]),
    pool('y5-gram2', 'Grammar: Modal Verbs and Adverbs for Possibility', [2, 1, 1]),
  ]

  it('pairs a Year 6 reading strand with Year 5 reading', () => {
    expect(findCounterpart('Reading: Inference and Authorial Intent', y5English)?.topicId).toBe(
      'y5-read',
    )
  })

  it('prefers the deepest pool when a family has several members', () => {
    expect(findCounterpart('Grammar: Subjunctive and Passive Voice', y5English)?.topicId).toBe(
      'y5-gram',
    )
  })

  it('still returns null when no family matches', () => {
    expect(findCounterpart('Handwriting: Joins', y5English)).toBeNull()
  })

  it('prefers a real title match over the family fallback', () => {
    const mixed = [
      pool('exact', 'Reading: Inference and Authorial Intent', [1, 0, 0]),
      pool('family', 'Reading: Something Else Entirely', [9, 9, 9]),
    ]
    expect(findCounterpart('Reading: Inference and Authorial Intent', mixed)?.topicId).toBe('exact')
  })
})

describe('strandFamily', () => {
  it('takes the part before the colon', () => {
    expect(strandFamily('Reading: Inference and Authorial Intent')).toBe('reading')
    expect(strandFamily('Grammar: Relative Clauses')).toBe('grammar')
  })

  it('returns null for a title with no colon, which is most maths topics', () => {
    expect(strandFamily('Multiplication and Division')).toBeNull()
    expect(strandFamily('Addition and Subtraction')).toBeNull()
  })

  it('refuses "Number", which prefixes half the maths topics and pairs nothing', () => {
    // "Number: Fractions" and "Number: Place Value" are not the same strand.
    expect(strandFamily('Number: Fractions')).toBeNull()
    expect(strandFamily('Number: Place Value')).toBeNull()
  })

  it('does not pair unrelated maths topics through the fallback', () => {
    const y3 = [pool('y3-frac', 'Number: Fractions', [5, 3, 2])]
    expect(findCounterpart('Number: Place Value', y3)).toBeNull()
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

describe('questionsAreNearDuplicates', () => {
  it('does NOT catch a long rewording that shares only three words', () => {
    // Documented limit, not an oversight. These two came out of one live Year 6
    // English strand and they are duplicates in meaning. Catching them needs a
    // threshold of three shared words, and at three the rule also collapses a
    // perimeter question with an area question (see the test below). A false
    // positive removes a good question from the pool, so the threshold stays at
    // four and semantic duplicates are left to the pipeline's embedding dedup.
    expect(
      questionsAreNearDuplicates(
        'Which sentence is written in the passive voice?',
        'Which sentence uses the passive voice to avoid mentioning who performed the action?',
      ),
    ).toBe(false)
  })

  it('catches the same word problem with the numbers changed', () => {
    expect(
      questionsAreNearDuplicates(
        'A rectangle is 9 cm long and 3 cm wide. What is its perimeter?',
        'A rectangle is 9 cm long and 4 cm wide. What is the perimeter of the rectangle?',
      ),
    ).toBe(true)
  })

  it('catches one stem with different worked examples pasted after it', () => {
    // Both were drawn into the same live Year 6 English strand. Word overlap
    // alone scores these at 0.57, because the examples swamp the stem.
    expect(
      questionsAreNearDuplicates(
        "Which sentence is written in the passive voice? 'A) The dog chased the ball.' 'B) The ball was chased by the dog.'",
        "Which sentence is written in the passive voice? 'A) The firefighters rescued the family.' 'B) The family was rescued by the firefighters.'",
      ),
    ).toBe(true)
  })

  it('also flags a question that shares the stem and adds a condition', () => {
    // "…in the passive voice?" against "…in the passive voice AND uses the past
    // tense?" tests a bit more, but it reads as the same question twice inside a
    // five-item strand. Preferring something else costs nothing: the second pass
    // in takeSpreadAcrossTiers still fills the strand if there is no alternative.
    expect(
      questionsAreNearDuplicates(
        "Which sentence is written in the passive voice? 'A) The dog chased the ball.'",
        'Which sentence is written in the passive voice AND uses the past tense?',
      ),
    ).toBe(true)
  })

  it('does not flag two word problems that share a setup but ask different things', () => {
    expect(
      questionsAreNearDuplicates(
        'A rectangle is 9 cm long and 3 cm wide. What is its perimeter?',
        'A rectangle is 12 cm long and 5 cm wide. What is its area?',
      ),
    ).toBe(false)
  })

  it('sees through a singular/plural rewording of the same stem', () => {
    expect(
      questionsAreNearDuplicates(
        "Which sentence is written in the passive voice? 'A) The dog chased the ball.'",
        'Which of these sentences is written in the passive voice?',
      ),
    ).toBe(true)
  })

  it('leaves arithmetic alone, which shares almost no meaningful words', () => {
    expect(questionsAreNearDuplicates('What is 3 x 4?', 'What is 5 x 6?')).toBe(false)
    expect(questionsAreNearDuplicates('What is 1/4 of 20?', 'What is 1/3 of 12?')).toBe(false)
  })

  it('leaves genuinely different questions about one topic alone', () => {
    expect(
      questionsAreNearDuplicates(
        'Which sentence is a question?',
        'Which sentence is a command?',
      ),
    ).toBe(false)
    expect(
      questionsAreNearDuplicates(
        'Which sentence uses a capital letter correctly?',
        'Which sentence uses the correct punctuation?',
      ),
    ).toBe(false)
  })

  it('is symmetric and safe on empty input', () => {
    const a = 'Which sentence is written in the passive voice?'
    const b = 'Which sentence uses the passive voice to avoid mentioning who performed the action?'
    expect(questionsAreNearDuplicates(a, b)).toBe(questionsAreNearDuplicates(b, a))
    expect(questionsAreNearDuplicates('', '')).toBe(false)
    expect(questionsAreNearDuplicates('What is it?', '')).toBe(false)
  })
})

describe('planCheck — near-duplicate avoidance', () => {
  /** A pool where three of the five questions are the same question reworded. */
  function poolWithDuplicates(): TopicPool {
    const p = pool('t', 'Grammar: Passive Voice', [3, 2, 1])
    return {
      ...p,
      texts: {
        // Same stem, different worked examples. This is the shape the guard is
        // built for, and the shape the live English Year 6 pool actually had.
        't-sprout-0': "Which sentence is written in the passive voice? 'A) The dog chased the ball.'",
        't-sprout-1':
          "Which sentence is written in the passive voice? 'A) The firefighters rescued the family.'",
        't-sprout-2': "Which sentence is written in the passive voice? 'A) The chef baked a cake.'",
        't-explorer-0': 'Name the tense used in this sentence.',
        't-explorer-1': 'Rewrite this sentence so it starts with a fronted adverbial.',
        't-lightning-0': 'Explain why an author might prefer one construction here.',
      },
    }
  }

  it('prefers a different question over a reworded one', () => {
    const p = poolWithDuplicates()
    const taken = takeSpreadAcrossTiers(p, 3, 0)
    const texts = taken.map((id) => p.texts![id])
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        expect(questionsAreNearDuplicates(texts[i], texts[j])).toBe(false)
      }
    }
  })

  it('honours texts already used elsewhere in the check', () => {
    const p = poolWithDuplicates()
    const taken = takeSpreadAcrossTiers(p, 1, 0, undefined, [
      "Which sentence is written in the passive voice? 'A) The cat sat on the mat.'",
    ])
    expect(p.texts![taken[0]]).not.toContain('passive voice')
  })

  it('still returns a full-length strand when the pool is all duplicates', () => {
    // A blemish beats a short strand: a missing item would change the score.
    const p: TopicPool = {
      ...pool('t', 'Passive Voice', [3, 0, 0]),
      texts: {
        't-sprout-0': 'Which sentence is written in the passive voice today?',
        't-sprout-1': 'Which sentence is written in the passive voice here?',
        't-sprout-2': 'Which sentence is written in the passive voice now?',
      },
    }
    expect(takeSpreadAcrossTiers(p, 3, 0)).toHaveLength(3)
  })

  it('works unchanged when a pool carries no texts at all', () => {
    expect(takeSpreadAcrossTiers(pool('t', 'x', [3, 3, 3]), 3, 0)).toHaveLength(3)
  })
})

describe('isSelfContained', () => {
  // Every rejection below is a real question that reached a built Year 1 Maths
  // check and could not be answered, because the thing it asks about was in a
  // lesson the Skills Check does not show.
  it('rejects a question about a picture that is not there', () => {
    for (const q of [
      'Which equation matches the number line.',
      'Which toy is at the front of the line?',
      'Look at the diagram and answer.',
      'What does the chart show about rainfall?',
    ]) {
      expect(isSelfContained(q)).toBe(false)
    }
  })

  it('rejects a stem too short to carry its own context', () => {
    expect(isSelfContained('Identify the verbs.')).toBe(false)
    expect(isSelfContained('An author is ...')).toBe(false)
  })

  it('keeps a short question whose numbers make it self-contained', () => {
    expect(isSelfContained('What is 10 × 4?')).toBe(true)
    expect(isSelfContained('Expand 7(y+8).')).toBe(true)
    expect(isSelfContained('What is 50 + 7?')).toBe(true)
  })

  it('keeps questions about shapes named indefinitely', () => {
    expect(isSelfContained('How many corners does a triangle have?')).toBe(true)
    expect(isSelfContained('A shape has 4 equal sides and 4 equal corners. What is it called?')).toBe(true)
    expect(isSelfContained('How many sides does an octagon have?')).toBe(true)
  })

  it('keeps a question that quotes the text it asks about', () => {
    expect(
      isSelfContained("Which word is the verb in this sentence?\n\n'The hungry fox ran across the field.'"),
    ).toBe(true)
  })
})

describe('hasSingleAnswerPhrasing', () => {
  it('rejects plural phrasing, which cannot have one right answer', () => {
    for (const q of [
      'Identify the verbs.',
      'Tick the verbs in this sentence.',
      'Which of these shapes are quadrilaterals?',
      'Select all the prime numbers.',
      'Which two numbers add to 10?',
    ]) {
      expect(hasSingleAnswerPhrasing(q)).toBe(false)
    }
  })

  it('keeps singular phrasing', () => {
    expect(hasSingleAnswerPhrasing('Which word is the verb in this sentence?')).toBe(true)
    expect(hasSingleAnswerPhrasing('Which shape is a quadrilateral?')).toBe(true)
    expect(hasSingleAnswerPhrasing('Tick the correct punctuation mark.')).toBe(true)
  })
})

describe('isSuitableForPublicCheck — all three gates together', () => {
  it('rejects a question that fails any one of them', () => {
    expect(isSuitableForPublicCheck('In the battle, 1,200 soldiers were killed. How many remained?')).toBe(false)
    expect(isSuitableForPublicCheck('Which equation matches the number line.')).toBe(false)
    expect(isSuitableForPublicCheck('Identify the verbs.')).toBe(false)
  })

  it('keeps an ordinary question', () => {
    expect(isSuitableForPublicCheck('A baker makes 9 batches of 6 cookies. How many cookies?')).toBe(true)
  })
})

describe('poolSize', () => {
  it('counts every tier', () => {
    expect(poolSize(pool('t', 'x', [2, 3, 4]))).toBe(9)
  })
})
