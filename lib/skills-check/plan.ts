/**
 * Decifer Skills Check — planning a check's item list.
 *
 * WHY THIS IS SEPARATE FROM SCORING: scoring reads answers, planning decides
 * which 20 questions a check is made of. Both are pure so both can be tested,
 * but only planning needs to reason about the curriculum's shape.
 *
 * The shape (docs/SKILLS_CHECK_SCOPE.md §4a):
 *   4 strands x 5 items = 20.
 *   Per strand: 1 item from the year below, 3 at year, 1 from the year above.
 *
 * The hard part is "the year below". A strand is a topic in the check's own
 * year, and its year-below counterpart has to be found by name, because nothing
 * in the database links "Year 4 Multiplication and Division" to "Year 3 Number:
 * Multiplication and Division". Titles across years are close but not equal, so
 * this module matches on normalised token overlap and refuses a weak match
 * rather than pairing a fractions strand with a geometry topic.
 *
 * The 3 at-year items take one of each tier where possible, so a strand spans
 * the difficulty range instead of sampling three easy questions and calling the
 * child secure.
 *
 * PURE: no DB, no network, no AI. The database half lives in
 * lib/skills-check/build.ts (server-only).
 */

import type { ItemBand } from './score'

export type Tier = 'sprout' | 'explorer' | 'lightning'

/** Strands per check, and items per strand. Together these make the 20. */
export const STRANDS_PER_CHECK = 4
export const ITEMS_PER_STRAND = 5

/** Band make-up of one strand. Order is the order a child sees them. */
export const STRAND_BAND_PLAN: ItemBand[] = ['below', 'at', 'at', 'at', 'above']

/**
 * Minimum token overlap before two topic titles count as the same strand across
 * years. 0.5 means half the meaningful words match, which pairs "Number:
 * Multiplication and Division" with "Multiplication and Division" and refuses to
 * pair "Number: Fractions" with "Number: Place Value".
 */
export const MIN_TITLE_SIMILARITY = 0.5

/** Words that carry no subject meaning in a topic title. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'and', 'in', 'on', 'with', 'for',
  'number', 'numbers', 'maths', 'mathematics', 'english', 'science',
  'year', 'unit', 'topic',
])

/**
 * Reduce a topic title to the set of words that carry its subject meaning.
 * "Number: Multiplication and Division" and "Multiplication and Division" both
 * become {multiplication, division}.
 *
 * 'number' is a stop word because it prefixes a large share of maths topics
 * ("Number: Fractions", "Number and Place Value") and so tells us nothing about
 * which strand a topic is.
 */
export function titleTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  return new Set(words)
}

/** Jaccard overlap of two titles' meaningful words. 1 = identical, 0 = nothing shared. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a)
  const tb = titleTokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const w of ta) if (tb.has(w)) shared += 1
  const union = ta.size + tb.size - shared
  return union === 0 ? 0 : shared / union
}

export interface TopicPool {
  topicId: string
  title: string
  /** Published question ids for this topic, grouped by tier. */
  byTier: Record<Tier, string[]>
}

/**
 * Themes that must not appear in a Skills Check.
 *
 * WHY THIS EXISTS: the August 2026 content audit found primary maths questions
 * using war casualties and slavery as the countable objects in arithmetic. A
 * check is taken by a young child, unsupervised, on a public page, with a parent
 * judging the product by it. The first live plan for Year 4 Maths pulled in
 * "Nazi Germany invaded the Soviet Union… how many miles were pushed back" as a
 * stretch item, which is how this list came to be written.
 *
 * The rule is NARROW and it is about arithmetic dressing, not about topics. A
 * history topic is entitled to teach the Holocaust. A multiplication question is
 * not entitled to use it as scenery. Skills Checks cover Maths and English only,
 * so screening the whole item pool is the right scope here.
 *
 * Whole-word matching only. Substring matching refuses innocent words: "war"
 * inside "toward", "died" inside "studied".
 *
 * This is a stopgap in front of a content problem. The durable fix is retiring
 * the offending questions, not filtering them at read time.
 */
export const EXCLUDED_THEME_WORDS = [
  'war', 'wars', 'wartime', 'battle', 'battles', 'soldier', 'soldiers',
  'killed', 'kill', 'deaths', 'died', 'dead', 'casualties', 'wounded',
  'massacre', 'genocide', 'holocaust', 'nazi', 'nazis',
  'slave', 'slaves', 'slavery', 'enslaved',
  'execution', 'executed', 'bombing', 'bombed', 'bombs',
  'famine', 'starved', 'starvation', 'refugees',
  'invaded', 'invasion',
]

const EXCLUDED_THEME_RE = new RegExp(`\\b(${EXCLUDED_THEME_WORDS.join('|')})\\b`, 'i')

/**
 * True when a question is safe to put in a public Skills Check.
 *
 * Deliberately conservative: the cost of dropping a usable question is one item
 * out of a bank of thousands, and the cost of keeping a bad one is a parent's
 * first impression of the product.
 */
export function isSuitableForPublicCheck(questionText: string): boolean {
  return !EXCLUDED_THEME_RE.test(questionText)
}

/** Total published questions in a pool. */
export function poolSize(pool: TopicPool): number {
  return pool.byTier.sprout.length + pool.byTier.explorer.length + pool.byTier.lightning.length
}

/**
 * Find the counterpart of `strandTitle` in another year's topics.
 *
 * Returns the best match at or above MIN_TITLE_SIMILARITY, or null. Null is a
 * real answer, not a failure: some strands genuinely have no equivalent in the
 * year below (algebra does not appear in Year 3), and inventing one would make
 * the "working below" claim meaningless.
 *
 * Ties keep input order, so a rebuild of the same check picks the same topic.
 */
export function findCounterpart(
  strandTitle: string,
  candidates: TopicPool[],
  minSimilarity: number = MIN_TITLE_SIMILARITY,
): TopicPool | null {
  let best: TopicPool | null = null
  let bestScore = 0
  for (const c of candidates) {
    const score = titleSimilarity(strandTitle, c.title)
    if (score >= minSimilarity && score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/**
 * Take `n` question ids from a pool, spreading across tiers.
 *
 * Order is sprout, explorer, lightning, then round again. So 3 items give one of
 * each where the pool allows, and a strand is never judged on three easy
 * questions. `startIndex` rotates which question of a tier is taken, so two
 * checks built from the same pool do not use identical items.
 */
export function takeSpreadAcrossTiers(
  pool: TopicPool,
  n: number,
  startIndex = 0,
  preferred: Tier[] = ['sprout', 'explorer', 'lightning'],
): string[] {
  const taken: string[] = []
  const used = new Set<string>()
  let round = 0
  while (taken.length < n && round < 10) {
    for (const tier of preferred) {
      if (taken.length >= n) break
      const ids = pool.byTier[tier]
      if (ids.length === 0) continue
      // Walk from the rotated start until an unused id turns up.
      for (let k = 0; k < ids.length; k++) {
        const id = ids[(startIndex + round + k) % ids.length]
        if (!used.has(id)) {
          used.add(id)
          taken.push(id)
          break
        }
      }
    }
    round += 1
  }
  return taken
}

export interface PlannedItem {
  questionId: string
  band: ItemBand
  strandTopicId: string
  position: number
}

export interface PlannedStrand {
  strandTopicId: string
  strandTitle: string
  items: PlannedItem[]
  /** True when a year-below or year-above counterpart could not be found. */
  incomplete: boolean
}

export interface CheckPlan {
  strands: PlannedStrand[]
  items: PlannedItem[]
  /** Strand titles that were considered and rejected, with the reason. */
  skipped: { title: string; reason: string }[]
}

export interface PlanInput {
  /** Topics in the check's own year, for this subject. */
  atYear: TopicPool[]
  /** Topics one year below. Empty for Year 1. */
  belowYear: TopicPool[]
  /** Topics one year above. Empty for the top year. */
  aboveYear: TopicPool[]
}

/**
 * Plan a whole check.
 *
 * Strand choice: the at-year topics with the deepest published pools, because a
 * deep pool is the best available proxy for a topic we can ask about fairly, and
 * a topic with fewer than 3 published questions cannot fill its at-year band at
 * all.
 *
 * A strand whose counterpart year is missing (Year 1 has no year below) simply
 * takes another at-year item in its place, so the check is always
 * ITEMS_PER_STRAND long. The band mix is recorded per item, so scoring sees the
 * truth and skips the year-below rule rather than failing the child on evidence
 * that was never gathered.
 */
export function planCheck(input: PlanInput, strandsWanted = STRANDS_PER_CHECK): CheckPlan {
  const skipped: { title: string; reason: string }[] = []

  const eligible = [...input.atYear].filter((t) => {
    const atCount = STRAND_BAND_PLAN.filter((b) => b === 'at').length
    if (poolSize(t) < atCount) {
      skipped.push({ title: t.title, reason: `only ${poolSize(t)} published questions` })
      return false
    }
    return true
  })

  // Rank by how complete a strand can be FIRST, and only then by pool depth.
  //
  // Depth alone picks the wrong strands. On the live Year 4 Maths bank it chose
  // "Geometry: Position and Direction" (74 published questions) over "Number and
  // Place Value", because a topic that generated well is not the same as a topic
  // that matters. A strand that exists in the year below and the year above is,
  // by definition, a thread the curriculum carries through the years, which is
  // exactly what a working-level check should be built on.
  //
  // A missing neighbouring year (Year 1 has no year below) is not counted
  // against any strand, since no strand could satisfy it.
  const wantBelow = input.belowYear.length > 0
  const wantAbove = input.aboveYear.length > 0

  const ranked = eligible
    .map((t, idx) => {
      const hasBelow = !wantBelow || findCounterpart(t.title, input.belowYear) !== null
      const hasAbove = !wantAbove || findCounterpart(t.title, input.aboveYear) !== null
      return { t, idx, size: poolSize(t), completeness: (hasBelow ? 1 : 0) + (hasAbove ? 1 : 0) }
    })
    .sort((a, b) => {
      if (b.completeness !== a.completeness) return b.completeness - a.completeness
      if (b.size !== a.size) return b.size - a.size
      return a.idx - b.idx // stable, so a rebuild is reproducible
    })
    .map((x) => x.t)

  const chosen = ranked.slice(0, strandsWanted)
  for (const t of ranked.slice(strandsWanted)) {
    skipped.push({ title: t.title, reason: 'not among the deepest pools' })
  }

  const strands: PlannedStrand[] = []
  const items: PlannedItem[] = []
  let position = 0

  chosen.forEach((strand, strandIdx) => {
    const below = findCounterpart(strand.title, input.belowYear)
    const above = findCounterpart(strand.title, input.aboveYear)
    const strandItems: PlannedItem[] = []

    // Rotate the starting point per strand so four strands built from
    // overlapping pools do not all take the same first question.
    const rotate = strandIdx

    let atNeeded = 0
    const queued: { band: ItemBand; id: string }[] = []

    for (const band of STRAND_BAND_PLAN) {
      if (band === 'at') {
        atNeeded += 1
        continue
      }
      const source = band === 'below' ? below : above
      if (!source) {
        // No counterpart year. Backfill with an at-year item instead of a gap.
        atNeeded += 1
        continue
      }
      // Take the easiest available. A year-below item is a floor check, and a
      // year-above item should be the gentlest of the harder year, so both want
      // the default sprout-first order.
      const [id] = takeSpreadAcrossTiers(source, 1, rotate)
      if (id) queued.push({ band, id })
      else atNeeded += 1
    }

    const atIds = takeSpreadAcrossTiers(strand, atNeeded, rotate)
    for (const id of atIds) queued.push({ band: 'at', id })

    // Emit in the reading order of STRAND_BAND_PLAN: below, at, at, at, above.
    const order: ItemBand[] = ['below', 'at', 'above']
    for (const band of order) {
      for (const q of queued.filter((x) => x.band === band)) {
        const item: PlannedItem = {
          questionId: q.id,
          band,
          strandTopicId: strand.topicId,
          position: position++,
        }
        strandItems.push(item)
        items.push(item)
      }
    }

    strands.push({
      strandTopicId: strand.topicId,
      strandTitle: strand.title,
      items: strandItems,
      incomplete: !below || !above || strandItems.length < ITEMS_PER_STRAND,
    })
  })

  return { strands, items, skipped }
}
