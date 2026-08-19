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
  /**
   * Question text by id, used to keep near-duplicates out of one check.
   * Optional so tests and callers that do not care can leave it out.
   */
  texts?: Record<string, string>
}

// ── Near-duplicate questions ─────────────────────────────────────────────────
//
// The pipeline already dedupes published content by embedding similarity, and it
// still let this through: a Year 6 English check drew "Which sentence is written
// in the passive voice?" and "Which sentence uses the passive voice to avoid
// mentioning who performed the action?" into the same strand. Across 8,277
// questions that is invisible. Inside one 20-question test it is glaring, and it
// wastes one of only five chances to judge that strand.
//
// The guard below is lexical, not semantic. It is deliberately narrow: it fires
// only when two questions share several meaningful words AND one is largely
// contained in the other. Arithmetic questions, which share almost no meaningful
// words ("What is 3 x 4?" against "What is 5 x 6?"), never trip it.

/** Words that carry no meaning when comparing two question stems. */
const QUESTION_STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'of', 'to', 'in',
  'on', 'at', 'for', 'and', 'or', 'but', 'which', 'what', 'who', 'whom', 'whose',
  'how', 'why', 'when', 'where', 'that', 'this', 'these', 'those', 'it', 'its',
  'has', 'have', 'had', 'do', 'does', 'did', 'with', 'from', 'by', 'as', 'if',
  'you', 'your', 'below', 'following', 'correct', 'correctly', 'answer', 'choose',
  'select', 'tick', 'complete',
])

/**
 * Meaningful words in the order they appear, with plurals folded in.
 *
 * "Which sentence is written in the passive voice?" and "Which of these
 * sentences is written in the passive voice?" are the same question, and without
 * folding the plural their opening words differ at the first position. Stripping
 * one trailing "s" is crude, but it is applied to both sides equally, so a word
 * it mangles still matches its own mangling.
 */
function questionWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !QUESTION_STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
}

function questionTokens(text: string): Set<string> {
  return new Set(questionWords(text))
}

/**
 * How many opening words must match before two questions count as the same stem.
 *
 * The set-overlap rule below misses a common shape: two questions with the same
 * stem and different worked examples embedded in the text. "Which sentence is
 * written in the passive voice? A) The dog chased the ball…" and the same stem
 * with firefighters and a family score only 0.57 on overlap, because the example
 * words swamp the stem. They are still the same question.
 */
export const STEM_PREFIX_WORDS = 4

/** True when two questions open with the same run of meaningful words. */
function shareTheSameStem(a: string, b: string): boolean {
  const wa = questionWords(a)
  const wb = questionWords(b)
  if (wa.length < STEM_PREFIX_WORDS || wb.length < STEM_PREFIX_WORDS) return false
  for (let i = 0; i < STEM_PREFIX_WORDS; i++) {
    if (wa[i] !== wb[i]) return false
  }
  return true
}

/**
 * Shared meaningful words needed before the overlap rule can fire.
 *
 * Four, not three, and the difference matters. At three, "A rectangle is 9 cm
 * long and 3 cm wide. What is its perimeter?" and "A rectangle is 12 cm long and
 * 5 cm wide. What is its area?" both reduce to four meaningful words sharing
 * three of them, and get collapsed. They are not duplicates: one asks for
 * perimeter and the other for area.
 *
 * The bias here is deliberate. A missed duplicate is a blemish on one check. A
 * false positive silently removes a good question from the pool, and could take
 * the only area question out of a measurement strand. So this errs toward
 * missing duplicates, and the semantic cases it misses are the pipeline's
 * embedding dedup to catch, which is the right tool for them.
 */
export const DUPLICATE_MIN_SHARED_WORDS = 4

/**
 * Overlap coefficient at which two questions count as duplicates.
 *
 * Overlap, not Jaccard: the pair that prompted this scores 0.30 on Jaccard
 * because one question is twice as long as the other, and 0.75 on overlap. What
 * matters is that the shorter question is almost entirely contained in the
 * longer one, which is exactly what overlap measures.
 */
export const DUPLICATE_OVERLAP_THRESHOLD = 0.7

/**
 * True when two question stems are near-duplicates of each other.
 *
 * Two independent rules, either of which is enough:
 *   1. the same opening run of words, which catches one stem with different
 *      worked examples pasted after it;
 *   2. high word overlap, which catches one question reworded at length.
 */
export function questionsAreNearDuplicates(a: string, b: string): boolean {
  if (shareTheSameStem(a, b)) return true

  const ta = questionTokens(a)
  const tb = questionTokens(b)
  if (ta.size === 0 || tb.size === 0) return false
  let shared = 0
  for (const w of ta) if (tb.has(w)) shared += 1
  if (shared < DUPLICATE_MIN_SHARED_WORDS) return false
  return shared / Math.min(ta.size, tb.size) >= DUPLICATE_OVERLAP_THRESHOLD
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
  return (
    !EXCLUDED_THEME_RE.test(questionText) &&
    isSelfContained(questionText) &&
    hasSingleAnswerPhrasing(questionText)
  )
}

/**
 * True when a question can be answered from its own text.
 *
 * WHY: the bank contains questions lifted out of a lesson that still lean on
 * something the lesson showed. A Skills Check renders text only, so those arrive
 * unanswerable. Reading the built Year 1 Maths check found six of twenty like
 * this: "Which equation matches the number line." with no number line, "Which
 * toy is at the front of the line?" with no line, "How many cars are there
 * altogether?" with no cars, and three questions about which way a character is
 * facing with no map.
 *
 * Two signals, both narrow:
 *
 * 1. A definite reference to a visual thing the stem never describes. "the
 *    number line", "the diagram", "the picture". Indefinite ones are fine, so
 *    "A shape has 4 equal sides" and "How many corners does a triangle have?"
 *    both pass.
 * 2. A very short stem with no digits in it. "Identify the verbs." is nineteen
 *    characters and names no sentence to look at, so there is nothing to answer.
 *    The digit test keeps real short questions: "Expand 7(y+8)." and "What is
 *    10 × 4?" are self-contained precisely because the numbers are right there.
 *
 * This costs some good short questions. That is the right trade: a lost question
 * is one of thousands, and an unanswerable one is a parent's first impression.
 */
const UNSHOWN_VISUAL_RE =
  /\bthe (number line|line|diagram|picture|image|map|grid|chart|graph|array|model|table)\b/i

/**
 * Questions that assume the child sat a particular Decifer lesson.
 *
 * Found reading the built English checks: "According to the lesson, what can
 * reading non-fiction help you develop?" and "What is the name of the text about
 * the rescue of elephants in Myanmar?". Both are fine inside the lesson that
 * taught them. In a public check taken by a child who has never used Decifer,
 * they are unanswerable, and worse, they make the product look like it is
 * testing whether you bought it.
 */
const LESSON_BOUND_RE =
  /\b(according to (the|one|this) (lesson|video|clip|unit)|name of the (text|book|story|poem)|in (this|the) (lesson|video|clip)|in the [a-z ]{0,20}example)\b/i

/**
 * Questions about a specific set text.
 *
 * "In 'A Midsummer Night's Dream', why is Oberon angry with Puck?" and "In Mary
 * Shelley's 'Frankenstein', which best describes Frankenstein's attitude?" both
 * test whether a child studied that book, not whether they are working at their
 * year. A public check has to measure the skill, so these go.
 *
 * Narrow on purpose: it fires only when the stem OPENS by naming a titled work.
 * A question that quotes a sentence to analyse ("Read this sentence: 'The old
 * man walked slowly…'") is untouched, because the quote is not at the start
 * behind "In".
 */
// Lazy on the title, because titles contain apostrophes: "A Midsummer Night's
// Dream" stops a greedy [^']* match dead at "Night". The lazy form keeps
// extending until it finds the quote that is actually followed by a comma.
const SET_TEXT_RE = /^\s*In\s+([A-Z][\w.]*(\s+[A-Z][\w.]*)*'s\s+)?['"‘“].{4,80}?['"’”]\s*,/

/**
 * Refers to a text, passage or source that the question does not include.
 *
 * This one needs care, because most good comprehension questions also say "the
 * text" — they just quote it first. "Read the passage below… Maya trudged
 * through the snow…" is fine. "What does the text say about different forms of
 * reading?" is not, and both were in built English checks.
 *
 * The separator is whether the stem carries the text with it. A stem that quotes
 * something, or runs long enough to contain a passage, is keeping its side of the
 * bargain. A short one that just points at "the text" is not.
 */
const REFERS_TO_TEXT_RE = /\b(the|these|those) (text|texts|passage|passages|source|sources|extract|extracts|story|poem)\b/i

/**
 * A passage contains sentences. A title does not.
 *
 * Length and quotation marks both failed as signals. "Based on the sources,
 * which statement best explains why someone might read a text like 'Bandoola:
 * The Great Elephant Rescue'?" is long and quoted and shows none of its sources.
 * A real comprehension stem, quoted or not, always contains more than one
 * sentence: the instruction, the passage, and the question.
 */
const MIN_SENTENCES_FOR_A_PASSAGE = 2

function carriesAPassage(text: string): boolean {
  const sentences = (text.match(/[.!?]/g) ?? []).length
  return sentences >= MIN_SENTENCES_FOR_A_PASSAGE
}

/** Below this, a stem with no numbers in it cannot be carrying its own context. */
export const MIN_SELF_CONTAINED_LENGTH = 25

export function isSelfContained(questionText: string): boolean {
  const text = questionText.trim()
  if (UNSHOWN_VISUAL_RE.test(text)) return false
  if (LESSON_BOUND_RE.test(text)) return false
  if (SET_TEXT_RE.test(text)) return false
  if (REFERS_TO_TEXT_RE.test(text) && !carriesAPassage(text)) return false
  // A stem that opens mid-sentence is a fill-in-the-blank that lost its blank:
  // "is a type of story that is made up or imagined." The answer is guessable and
  // it reads as broken, which is the worse problem on a first impression.
  if (/^[a-z]/.test(text)) return false
  if (text.length < MIN_SELF_CONTAINED_LENGTH && !/\d/.test(text)) return false
  return true
}

/**
 * True when the stored correct answer is something a child can actually pick.
 *
 * Some rows store a bare option label — the answer is literally "C" — because the
 * question was written with an A/B/C/D list that lived somewhere else. The
 * options a check renders are the answer strings themselves, so such a question
 * shows four meaningless letters. Thirteen published rows are like this.
 */
export function hasUsableAnswer(correctAnswer: string, distractors?: unknown): boolean {
  const a = correctAnswer.trim()
  if (a.length === 0) return false

  // A single letter is only a problem when the WHOLE option set is option
  // labels. "Which letter is silent in the word 'thumb'?" has the answer "b" and
  // distractors like "m", "u", "h", and it is a perfectly good question. An
  // orphaned multiple choice has the answer "C" and distractors "A", "B", "D".
  // The difference is whether every option is drawn from A to D.
  const list = Array.isArray(distractors) ? distractors : []
  const options = [a, ...list.map((d) => (typeof d === 'string' ? d.trim() : ''))].filter(
    (o) => o.length > 0,
  )
  if (options.length >= 3 && options.every((o) => /^[A-Da-d]$/.test(o))) return false

  return true
}

/**
 * True when the phrasing asks for exactly one answer.
 *
 * The 31 July audit found this class the hard way: "Tick the verbs" is only
 * broken when a distractor is also correct, and 23 of 48 candidates were real.
 * A Skills Check has one right option by construction, so plural phrasing is
 * always wrong here regardless of the distractors, and cheap to exclude.
 */
const PLURAL_ANSWER_RE =
  /\b(tick (all|both|the \w+s)|select all|choose all|which (two|three)|identify the \w+s|which of (these|the following) [\w ]{0,20}are)\b/i

export function hasSingleAnswerPhrasing(questionText: string): boolean {
  return !PLURAL_ANSWER_RE.test(questionText)
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
  if (best) return best

  // Fall back to the strand family, the part before the colon.
  //
  // Maths topics recur by name: "Multiplication and Division" is called that in
  // Year 3, 4 and 5, so the title match above finds them. English topics do not.
  // Year 4 has "Reading: Comparisons Within and Across Texts", Year 5 has
  // "Reading: Figurative Language and Authorial Choices", Year 6 has "Reading:
  // Inference and Authorial Intent". Those are the same strand at three
  // difficulties, and matching on the full title scores them near zero.
  //
  // Without this, every English check came out with all four strands incomplete,
  // which means no year-below and no year-above items, which means the whole
  // working-level ladder collapses and the check can never say a child is
  // working below their year. That is most of what the check is for.
  //
  // Deepest pool wins within a family, ties keep input order.
  const family = strandFamily(strandTitle)
  if (!family) return null

  let bestInFamily: TopicPool | null = null
  for (const c of candidates) {
    if (strandFamily(c.title) !== family) continue
    if (!bestInFamily || poolSize(c) > poolSize(bestInFamily)) bestInFamily = c
  }
  return bestInFamily
}

/**
 * The strand family of a topic title: the part before the first colon,
 * normalised. "Reading: Inference and Authorial Intent" gives "reading".
 * Returns null for a title with no colon, which is most maths topics.
 */
export function strandFamily(title: string): string | null {
  const idx = title.indexOf(':')
  if (idx <= 0) return null
  const family = title.slice(0, idx).trim().toLowerCase()
  // "Number" prefixes half the maths topics ("Number: Fractions", "Number:
  // Place Value"), so it is far too coarse to pair strands with. Reading,
  // Grammar, Spelling, Writing, Punctuation and Vocabulary are real strands.
  if (family.length < 3 || family === 'number') return null
  return family
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
  /** Question texts already used in this check. Near-duplicates are skipped. */
  avoidTexts: string[] = [],
): string[] {
  const taken: string[] = []
  const used = new Set<string>()
  const avoid = [...avoidTexts]

  const textOf = (id: string): string | undefined => pool.texts?.[id]
  const isDuplicate = (id: string): boolean => {
    const text = textOf(id)
    if (!text) return false
    return avoid.some((seen) => questionsAreNearDuplicates(text, seen))
  }

  // Two passes. The first refuses near-duplicates; the second accepts them
  // rather than returning a short strand, because a repeated question is a blemish
  // and a missing question changes the score.
  for (const allowDuplicates of [false, true]) {
    let round = 0
    while (taken.length < n && round < 10) {
      for (const tier of preferred) {
        if (taken.length >= n) break
        const ids = pool.byTier[tier]
        if (ids.length === 0) continue
        // Walk from the rotated start until a usable id turns up.
        for (let k = 0; k < ids.length; k++) {
          const id = ids[(startIndex + round + k) % ids.length]
          if (used.has(id)) continue
          if (!allowDuplicates && isDuplicate(id)) continue
          used.add(id)
          taken.push(id)
          const text = textOf(id)
          if (text) avoid.push(text)
          break
        }
      }
      round += 1
    }
    if (taken.length >= n) break
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

  // Question texts already used anywhere in this check. Duplicate avoidance runs
  // across the WHOLE check, not per strand: the year-below item for one strand
  // and the at-year item for another are drawn from different pools and can
  // still be the same question in different words.
  const usedTexts: string[] = []
  const remember = (poolOf: TopicPool, id: string) => {
    const text = poolOf.texts?.[id]
    if (text) usedTexts.push(text)
  }

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
      const [id] = takeSpreadAcrossTiers(source, 1, rotate, undefined, usedTexts)
      if (id) {
        queued.push({ band, id })
        remember(source, id)
      } else {
        atNeeded += 1
      }
    }

    const atIds = takeSpreadAcrossTiers(strand, atNeeded, rotate, undefined, usedTexts)
    for (const id of atIds) {
      queued.push({ band: 'at', id })
      remember(strand, id)
    }

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
