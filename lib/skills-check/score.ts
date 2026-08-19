/**
 * Decifer Skills Check — scoring.
 *
 * WHY: the check answers one question for a parent, "is my child secure on what
 * the National Curriculum says they should know by now, and what should they do
 * next?" It is CRITERION-referenced, the same logic the DfE uses when it reports
 * whether a pupil met the expected standard for their year.
 *
 * It is deliberately NOT norm-referenced. A standardised score (mean 100, SD 15)
 * only means something because the test was first given to a large representative
 * sample. We have no such sample, so this module never produces a score on that
 * scale, a percentile, or any comparison against another child. See
 * docs/SKILLS_CHECK_SCOPE.md §1.
 *
 * Shape of a check (docs/SKILLS_CHECK_SCOPE.md §4a):
 *   20 items = 4 strands x 5 items.
 *   Within each strand: 1 item from the year below, 3 at year, 1 from the year
 *   above. The band split is what lets us say "working below / within / above"
 *   from only 20 answers.
 *
 * PURE: no DB, no network, no AI. Deterministic and fully unit-tested.
 */

/** Which year group an item was drawn from, relative to the check's year. */
export type ItemBand = 'below' | 'at' | 'above'

/** Per-strand verdict shown in the (gated) report. */
export type StrandVerdict = 'secure' | 'developing' | 'needs_work'

/** Overall placement shown in the (free) headline. */
export type WorkingLevel =
  | 'below_year'
  | 'towards_year'
  | 'within_year'
  | 'secure_year'
  | 'secure_ready_to_stretch'

/** Items per strand in a standard check. */
export const STRAND_ITEM_COUNT = 5

/** Strand verdict cut points, out of STRAND_ITEM_COUNT. */
export const STRAND_SECURE_MIN = 4
export const STRAND_DEVELOPING_MIN = 3

/**
 * Band cut points for the overall working level.
 *
 * These are editorial judgements, not measured values, and they are the first
 * thing to revisit once the check has real response data. They live here as
 * named constants so that tuning is a one-line change with a failing test.
 */
export const BELOW_BAND_PASS = 0.6
export const AT_BAND_WORKING = 0.5
export const AT_BAND_SECURE = 0.8
export const ABOVE_BAND_STRETCH = 0.5

export interface CheckAnswer {
  /** Topic the item was drawn from. This is the strand the result is grouped by. */
  strandTopicId: string
  /** Human-readable topic title, carried through so the report needs no second query. */
  strandTitle: string
  band: ItemBand
  correct: boolean
}

export interface StrandResult {
  strandTopicId: string
  strandTitle: string
  correct: number
  total: number
  verdict: StrandVerdict
}

export interface CheckResult {
  /** One entry per strand, in the order the strands first appear in the answers. */
  strands: StrandResult[]
  workingLevel: WorkingLevel
  /** Raw correct count across every item. */
  rawScore: number
  totalItems: number
  /** Proportion correct per band. Null when the check had no items in that band. */
  bandAccuracy: Record<ItemBand, number | null>
}

/** Verdict for a single strand from its correct count. */
export function strandVerdict(correct: number, total: number = STRAND_ITEM_COUNT): StrandVerdict {
  // Scale the cut points if a strand ever runs at a length other than the
  // standard 5, so a short strand is not silently judged more harshly.
  const secureMin = (STRAND_SECURE_MIN / STRAND_ITEM_COUNT) * total
  const developingMin = (STRAND_DEVELOPING_MIN / STRAND_ITEM_COUNT) * total
  if (correct >= secureMin) return 'secure'
  if (correct >= developingMin) return 'developing'
  return 'needs_work'
}

function accuracy(answers: CheckAnswer[], band: ItemBand): number | null {
  const inBand = answers.filter((a) => a.band === band)
  if (inBand.length === 0) return null
  return inBand.filter((a) => a.correct).length / inBand.length
}

/**
 * Place the child against the year the check was pitched at.
 *
 * Read the ladder top down. The first rule that matches wins:
 *   1. Weak on year-below items          -> working below this year
 *   2. Weak on at-year items             -> working towards this year
 *   3. Partly secure at year             -> working within this year
 *   4. Secure at year, not above         -> secure at this year
 *   5. Secure at year and coping above   -> secure and ready to stretch
 *
 * A check with no year-below items (Year 1 has no year below) skips rule 1
 * rather than failing the child on evidence that does not exist.
 */
export function workingLevelFromAnswers(answers: CheckAnswer[]): WorkingLevel {
  const below = accuracy(answers, 'below')
  const at = accuracy(answers, 'at')
  const above = accuracy(answers, 'above')

  if (below !== null && below < BELOW_BAND_PASS) return 'below_year'
  // With no at-year evidence there is nothing to place against, so report the
  // most cautious level rather than inventing a placement.
  if (at === null || at < AT_BAND_WORKING) return 'towards_year'
  if (at < AT_BAND_SECURE) return 'within_year'
  if (above === null || above < ABOVE_BAND_STRETCH) return 'secure_year'
  return 'secure_ready_to_stretch'
}

/** Score a completed check. Strand order follows first appearance in `answers`. */
export function scoreCheck(answers: CheckAnswer[]): CheckResult {
  const byStrand = new Map<string, { title: string; correct: number; total: number }>()
  for (const a of answers) {
    const existing = byStrand.get(a.strandTopicId)
    if (existing) {
      existing.total += 1
      if (a.correct) existing.correct += 1
    } else {
      byStrand.set(a.strandTopicId, {
        title: a.strandTitle,
        correct: a.correct ? 1 : 0,
        total: 1,
      })
    }
  }

  const strands: StrandResult[] = [...byStrand.entries()].map(([strandTopicId, s]) => ({
    strandTopicId,
    strandTitle: s.title,
    correct: s.correct,
    total: s.total,
    verdict: strandVerdict(s.correct, s.total),
  }))

  return {
    strands,
    workingLevel: workingLevelFromAnswers(answers),
    rawScore: answers.filter((a) => a.correct).length,
    totalItems: answers.length,
    bandAccuracy: {
      below: accuracy(answers, 'below'),
      at: accuracy(answers, 'at'),
      above: accuracy(answers, 'above'),
    },
  }
}

// ── The free teaser ──────────────────────────────────────────────────────────
//
// The result page shows the headline and two lines of summary with no email.
// Everything else — which strands, the verdicts, the next steps — sits behind
// the email gate (docs/SKILLS_CHECK_SCOPE.md §7). So the teaser must be true and
// useful on its own, while stopping short of anything a parent could act on.

export interface CheckTeaser {
  /** One sentence. "Secure at Year 3 maths, and ready to stretch." */
  headline: string
  /** Names the child's best strand. Safe to give away: it is the good news. */
  strongestLine: string
  /** Counts what is not yet secure WITHOUT naming it. That is the gated part. */
  gapLine: string
}

const WORKING_LEVEL_PHRASE: Record<WorkingLevel, (year: string, subject: string) => string> = {
  below_year: (year, subject) => `Working below ${year} ${subject}`,
  towards_year: (year, subject) => `Working towards ${year} ${subject}`,
  within_year: (year, subject) => `Working within ${year} ${subject}`,
  secure_year: (year, subject) => `Secure at ${year} ${subject}`,
  secure_ready_to_stretch: (year, subject) => `Secure at ${year} ${subject}, and ready to stretch`,
}

/** Plain-English label for a working level. `year` is "Year 4", `subject` is "maths". */
export function describeWorkingLevel(
  level: WorkingLevel,
  year: string,
  subject: string,
): string {
  return WORKING_LEVEL_PHRASE[level](year, subject)
}

const COUNT_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']

/**
 * Small counts as words, larger ones as digits.
 *
 * Exported because the report page and the report email both have to name how
 * many areas a child was actually checked on, and both used to say "four"
 * regardless. A check serves fewer items when one of its questions has been
 * retired since the check was built, and a report that overstates its own
 * sample size is exactly the thing §6 of the scope says not to do.
 */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n)
}

/**
 * Build the free teaser from a scored check.
 *
 * The strongest strand is the one with the highest proportion correct. Ties keep
 * the strand order of the result, so the same answers always give the same
 * teaser.
 */
export function buildTeaser(
  result: CheckResult,
  year: string,
  subject: string,
): CheckTeaser {
  const headline = `${describeWorkingLevel(result.workingLevel, year, subject)}.`

  const ranked = [...result.strands].sort(
    (a, b) => b.correct / b.total - a.correct / a.total,
  )
  const strongest = ranked[0]
  const strongestLine = strongest
    ? `Strongest area: ${strongest.strandTitle}.`
    : 'Not enough answers to name a strongest area.'

  const notSecure = result.strands.filter((s) => s.verdict !== 'secure').length
  const total = result.strands.length
  const totalWord = countWord(total).toLowerCase()

  // Three shapes, because "Four of the four areas are not secure yet" is what
  // the general form produces when nothing is secure, and it reads badly.
  let gapLine: string
  if (total === 0) {
    gapLine = 'Not enough answers to say more.'
  } else if (notSecure === 0) {
    gapLine = `All ${totalWord} areas we checked came out secure.`
  } else if (notSecure === total) {
    gapLine = `All ${totalWord} areas we checked need work.`
  } else {
    gapLine = `${countWord(notSecure)} of the ${totalWord} areas we checked ${
      notSecure === 1 ? 'is' : 'are'
    } not secure yet.`
  }

  return { headline, strongestLine, gapLine }
}
