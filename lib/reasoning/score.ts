/**
 * Decifer Reasoning Check — scoring and the free teaser.
 *
 * THE RULE THIS FILE EXISTS TO HOLD: no IQ number, no percentile, no
 * standardised score, no comparison with another child. Ever. Those are
 * norm-referenced, meaning they only say anything because the test was first
 * given to a large representative sample, and we have no such sample. A number
 * on that scale produced without one is invented, however good the test is.
 * Scope: docs/REASONING_TEST_SCOPE.md §2 and §9.
 *
 * What we report instead is countable and true: how many of each kind of puzzle
 * were right, the hardest level the child actually solved, and how long they
 * took. Every one of those is a fact about the sitting, not a claim about the
 * child.
 *
 * PURE: no DB, no network, no AI. Deterministic and unit-tested.
 */

import {
  ITEM_TYPE_LABELS,
  MAX_LEVEL,
  MIN_LEVEL,
  REASONING_ITEM_TYPES,
  type Level,
  type ReasoningItemType,
} from './generate'
import { ITEMS_PER_TYPE } from './plan'

/** How well a child did on one kind of puzzle. Not a grade for the child. */
export type TypeVerdict = 'strong' | 'developing' | 'needs_practice'

/** Cut points out of ITEMS_PER_TYPE. Editorial, and named so tuning is one line. */
export const TYPE_STRONG_MIN = 5
export const TYPE_DEVELOPING_MIN = 3

/**
 * How many different item types must show a correct answer at a level before we
 * will say the child "reached" it.
 *
 * Two, so a single lucky guess in one type cannot lift the headline. This is the
 * one number in the whole report that a parent will quote, so it should be the
 * conservative reading of the evidence rather than the flattering one.
 */
export const LEVEL_REACHED_MIN_TYPES = 2

/** One marked answer, as the scorer needs it. */
export interface AnsweredItem {
  type: ReasoningItemType
  level: Level
  correct: boolean
  /** Milliseconds the child spent on the item. Null when it was not recorded. */
  timeMs: number | null
}

export interface TypeResult {
  type: ReasoningItemType
  label: string
  correct: number
  total: number
  /** Hardest level answered correctly in this type. 0 when none were. */
  levelReached: number
  /** Median time on this type, in milliseconds. Null when no times were kept. */
  medianTimeMs: number | null
  verdict: TypeVerdict
}

export interface ReasoningResult {
  types: TypeResult[]
  rawScore: number
  totalItems: number
  /** Overall level reached. 0 means not enough evidence to name one. */
  levelReached: number
}

export function typeVerdict(correct: number, total: number = ITEMS_PER_TYPE): TypeVerdict {
  // Scale the cut points if a type ever runs short, so a 4-item type is not
  // judged more harshly than a 6-item one.
  const strongMin = (TYPE_STRONG_MIN / ITEMS_PER_TYPE) * total
  const developingMin = (TYPE_DEVELOPING_MIN / ITEMS_PER_TYPE) * total
  if (correct >= strongMin) return 'strong'
  if (correct >= developingMin) return 'developing'
  return 'needs_practice'
}

/** Middle value, averaging the two middles on an even count. Null when empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * The highest level solved in at least LEVEL_REACHED_MIN_TYPES different types.
 *
 * Read it as: "this child solved level-4 puzzles in more than one kind of
 * reasoning". That is a sentence we can defend from the answer sheet alone,
 * which is the whole test for anything in this report.
 */
export function overallLevelReached(types: TypeResult[]): number {
  for (let level = MAX_LEVEL; level >= MIN_LEVEL; level--) {
    if (types.filter((t) => t.levelReached >= level).length >= LEVEL_REACHED_MIN_TYPES) {
      return level
    }
  }
  return 0
}

/** Score a finished paper. Types come back in the fixed REASONING_ITEM_TYPES order. */
export function scoreReasoning(answers: AnsweredItem[]): ReasoningResult {
  const types: TypeResult[] = REASONING_ITEM_TYPES.map((type) => {
    const mine = answers.filter((a) => a.type === type)
    const correct = mine.filter((a) => a.correct)
    const times = mine
      .map((a) => a.timeMs)
      .filter((t): t is number => typeof t === 'number' && t >= 0)

    return {
      type,
      label: ITEM_TYPE_LABELS[type],
      correct: correct.length,
      total: mine.length,
      levelReached: correct.reduce((best, a) => Math.max(best, a.level), 0),
      medianTimeMs: median(times),
      verdict: typeVerdict(correct.length, mine.length || ITEMS_PER_TYPE),
    }
  }).filter((t) => t.total > 0)

  return {
    types,
    rawScore: answers.filter((a) => a.correct).length,
    totalItems: answers.length,
    levelReached: overallLevelReached(types),
  }
}

// ── The free teaser ──────────────────────────────────────────────────────────
//
// The result page shows this with no email asked for. Everything else — the
// per-type scores, the levels, the timings, the practice — sits behind the gate
// (scope §7). So the teaser has to be true and worth reading on its own, while
// stopping short of anything a parent could act on.

export interface ReasoningTeaser {
  /** "Reached level 4 of 6." */
  headline: string
  /** Names the best type. Safe to give away: it is the good news. */
  strongestLine: string
  /** Counts what needs practice WITHOUT naming it. That is the gated part. */
  gapLine: string
}

const COUNT_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n)
}

export function buildTeaser(result: ReasoningResult): ReasoningTeaser {
  const headline =
    result.levelReached === 0
      ? 'Not enough right answers to place a level this time.'
      : `Reached level ${result.levelReached} of ${MAX_LEVEL}.`

  // Best by proportion correct, then by the hardest level solved. Ties keep the
  // fixed type order, so the same answers always give the same teaser.
  const ranked = [...result.types].sort(
    (a, b) => b.correct / b.total - a.correct / a.total || b.levelReached - a.levelReached,
  )
  const strongest = ranked[0]
  const strongestLine =
    strongest && strongest.correct > 0
      ? `Strongest kind of puzzle: ${strongest.label.toLowerCase()}.`
      : 'Nothing stood out as a strength this time.'

  const weak = result.types.filter((t) => t.verdict !== 'strong').length
  const total = result.types.length
  const totalWord = countWord(total).toLowerCase()

  let gapLine: string
  if (total === 0) {
    gapLine = 'Not enough answers to say more.'
  } else if (weak === 0) {
    gapLine = `All ${totalWord} kinds of puzzle came out strong.`
  } else if (weak === total) {
    gapLine = `All ${totalWord} kinds of puzzle would benefit from practice.`
  } else {
    gapLine = `${countWord(weak)} of the ${totalWord} kinds of puzzle ${
      weak === 1 ? 'needs' : 'need'
    } practice.`
  }

  return { headline, strongestLine, gapLine }
}

// ── Practice ─────────────────────────────────────────────────────────────────

/**
 * What to actually do about a weak type, and where to read more.
 *
 * One line each, because a parent acts on one line and reads past a paragraph.
 * The anchors point at the worked examples on /reasoning/non-verbal, which are
 * generated by the same code that generated the test.
 */
export const PRACTICE: Record<ReasoningItemType, { anchor: string; tip: string }> = {
  sequence: {
    anchor: 'sequences',
    tip: 'Ask what changes from one shape to the next, one thing at a time: how many, which shape, how it is filled, which way up.',
  },
  matrix: {
    anchor: 'matrices',
    tip: 'Read a grid across first, then down. Two separate rules are at work, and finding them one at a time is far easier than both at once.',
  },
  analogy: {
    anchor: 'analogies',
    tip: 'Say the first change out loud as a sentence, then do that same sentence to the third shape.',
  },
  odd_one_out: {
    anchor: 'odd-one-out',
    tip: 'Check one property across all five before moving on: all the shapes, then all the fills, then all the counts.',
  },
}

export interface PracticeStep {
  type: ReasoningItemType
  label: string
  tip: string
  url: string
}

/** Practice suggestions for the weakest types, worst first. */
export const MAX_PRACTICE_STEPS = 3

export function buildPracticeSteps(result: ReasoningResult): PracticeStep[] {
  return [...result.types]
    .filter((t) => t.verdict !== 'strong')
    .sort((a, b) => a.correct / a.total - b.correct / b.total || a.levelReached - b.levelReached)
    .slice(0, MAX_PRACTICE_STEPS)
    .map((t) => ({
      type: t.type,
      label: t.label,
      tip: PRACTICE[t.type].tip,
      url: `/reasoning/non-verbal#${PRACTICE[t.type].anchor}`,
    }))
}

/**
 * How much slower than the quickest type a type must be before we call it out.
 *
 * Without a threshold, four types all at 4.0 seconds still produce a "slowest",
 * and the report tells a parent to work on speed in an area that was no slower
 * than the rest. A quarter again as long is a difference somebody could act on.
 */
export const SLOWEST_TYPE_RATIO = 1.25

/**
 * The type that genuinely dragged, or null when nothing stands out.
 *
 * Null is the honest answer far more often than it looks: on a short test the
 * medians cluster, and naming a "slowest" out of noise is exactly the kind of
 * confident nonsense this report is supposed to avoid.
 */
export function slowestType(types: TypeResult[]): TypeResult | null {
  const timed = types.filter((t): t is TypeResult & { medianTimeMs: number } => t.medianTimeMs !== null)
  if (timed.length < 2) return null

  const slowest = timed.reduce((worst, t) => (t.medianTimeMs > worst.medianTimeMs ? t : worst))
  const quickest = timed.reduce((best, t) => (t.medianTimeMs < best.medianTimeMs ? t : best))
  if (quickest.medianTimeMs <= 0) return null
  return slowest.medianTimeMs >= quickest.medianTimeMs * SLOWEST_TYPE_RATIO ? slowest : null
}

/** "1.4s", "12s". Report timings the way a person reads them. */
export function formatMs(ms: number | null): string {
  if (ms === null) return '—'
  const seconds = ms / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  return `${Math.round(seconds)}s`
}
