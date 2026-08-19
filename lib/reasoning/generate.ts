/**
 * Decifer Reasoning Check — item generation.
 *
 * Four non-verbal reasoning item types, six difficulty levels, all generated
 * from a seed. Scope: docs/REASONING_TEST_SCOPE.md.
 *
 * THE POINT OF THIS FILE: the correct answer is produced by construction, not
 * decided by a model and then checked. We build the rule first, apply it to get
 * the answer, and then build every distractor by breaking exactly one part of
 * that rule. So an item cannot have a wrong answer, and every wrong option is
 * plausible for a reason we can name.
 *
 * AMBIGUITY IS THE REAL RISK, not correctness. An item where two options both
 * satisfy a defensible rule is worse than a wrong answer, because nobody can
 * prove it. `validateItem()` rejects those, and the generators resample until an
 * item passes. That check is the guarantee the whole product rests on.
 *
 * PURE: no DB, no network, no Math.random(), no Date.now(). Same seed, same item,
 * forever, which is what lets the server store a seed instead of a question.
 */

import { Rng } from '@/lib/seeded-random'
import {
  SHAPE_KINDS,
  FILLS,
  SIZES,
  ROTATIONS,
  COUNTS,
  figuresEqual,
  visualKey,
  effectiveRotation,
  type Figure,
} from './shapes'

export type ReasoningItemType = 'sequence' | 'matrix' | 'analogy' | 'odd_one_out'
export const REASONING_ITEM_TYPES: ReasoningItemType[] = [
  'sequence',
  'matrix',
  'analogy',
  'odd_one_out',
]

export const MIN_LEVEL = 1
export const MAX_LEVEL = 6
export type Level = 1 | 2 | 3 | 4 | 5 | 6

export const ITEM_TYPE_LABELS: Record<ReasoningItemType, string> = {
  sequence: 'Sequences',
  matrix: 'Matrices',
  analogy: 'Analogies',
  odd_one_out: 'Odd one out',
}

/** Which figure attribute a rule acts on. */
export type Attribute = 'kind' | 'size' | 'fill' | 'rotation' | 'count'
export const ATTRIBUTES: Attribute[] = ['kind', 'size', 'fill', 'rotation', 'count']

const DOMAINS = {
  kind: SHAPE_KINDS,
  size: SIZES,
  fill: FILLS,
  rotation: ROTATIONS,
  count: COUNTS,
} as const

/**
 * Attributes ordered by how obvious a change in them is to a child.
 *
 * Count and kind read instantly. A 45° rotation is the subtlest thing here. Low
 * levels draw from the front of this list, high levels from anywhere.
 */
const ATTRIBUTES_BY_OBVIOUSNESS: Attribute[] = ['count', 'kind', 'fill', 'size', 'rotation']

/**
 * Rotation is the one attribute that may always run off the end and back to the
 * start, because a shape spinning past 315° to 0° is plainly a full turn.
 *
 * Everything else is bounded by default. Two previews of real generated items
 * taught this, and neither was caught by a test:
 *   - a row of one shape, four shapes, three, two: the "subtract one, wrapping"
 *     rule is consistent and answerable, and it looks like a bug;
 *   - a row of empty, striped, dotted, solid, where the answer is empty again:
 *     the wrap is a bigger leap than the rule it wraps, so it belonged at a
 *     high level, not at level 1.
 *
 * So wrapping is now a difficulty feature (see WRAP_FROM_LEVEL), not a default.
 */
const ALWAYS_CYCLIC: Attribute[] = ['rotation']

/**
 * Attributes allowed to wrap once the level is high enough. "The pattern loops
 * back" is a legitimately harder inference, so it earns its place at level 5.
 *
 * Size stays out entirely. Large jumping back to small reads as a mistake at any
 * level.
 */
const CYCLIC_WHEN_HARD: Attribute[] = ['kind', 'fill', 'count']

/** The level from which CYCLIC_WHEN_HARD attributes may wrap. */
export const WRAP_FROM_LEVEL = 5

/** Attributes whose runs must be kept inside their range at this level. */
function boundedAt(level: Level): Attribute[] {
  const cyclic =
    level >= WRAP_FROM_LEVEL ? [...ALWAYS_CYCLIC, ...CYCLIC_WHEN_HARD] : ALWAYS_CYCLIC
  return ATTRIBUTES.filter((a) => !cyclic.includes(a))
}

/** One part of a rule: advance `attribute` by `delta` positions, wrapping round. */
export interface Step {
  attribute: Attribute
  delta: number
}

/** A rule is one or more steps applied together. */
export type Rule = Step[]

function domainIndex(f: Figure, attribute: Attribute): number {
  const domain = DOMAINS[attribute] as readonly unknown[]
  return domain.indexOf(f[attribute])
}

/** Advance one attribute by `delta`, wrapping. Wrapping makes every rule total. */
function advance(f: Figure, attribute: Attribute, delta: number): Figure {
  const domain = DOMAINS[attribute] as readonly unknown[]
  const idx = domainIndex(f, attribute)
  const next = ((idx + delta) % domain.length + domain.length) % domain.length
  return { ...f, [attribute]: domain[next] } as Figure
}

/** Apply a rule `times` times. `times` may be 0 or negative. */
export function applyRule(figure: Figure, rule: Rule, times = 1): Figure {
  let out = figure
  for (const step of rule) {
    out = advance(out, step.attribute, step.delta * times)
  }
  return out
}

// ── The item ─────────────────────────────────────────────────────────────────

export type Stimulus =
  | { kind: 'sequence'; figures: Figure[] }
  /** 3x3, exactly one cell null. That null is what the child fills. */
  | { kind: 'matrix'; grid: (Figure | null)[][] }
  | { kind: 'analogy'; a: Figure; b: Figure; c: Figure }
  /** For odd-one-out the stimulus IS the options; kept for renderer symmetry. */
  | { kind: 'odd_one_out' }

export interface ReasoningItem {
  type: ReasoningItemType
  level: Level
  seed: string
  prompt: string
  stimulus: Stimulus
  options: Figure[]
  correctIndex: number
}

const PROMPTS: Record<ReasoningItemType, string> = {
  sequence: 'Which shape comes next?',
  matrix: 'Which shape fills the empty square?',
  analogy: 'Complete the pair. Which shape goes in the gap?',
  odd_one_out: 'Which one is the odd one out?',
}

// ── Rule building ────────────────────────────────────────────────────────────

/** How many attributes a rule varies at each level. */
function stepCountForLevel(level: Level): number {
  if (level <= 2) return 1
  if (level <= 4) return 2
  return 3
}

/**
 * Which attributes a level is allowed to use.
 *
 * Level 1 uses only the most obvious attributes. Level 4 and up must include
 * rotation, which is what makes these items feel like a real test rather than a
 * spot-the-difference.
 */
function attributesForLevel(level: Level, rng: Rng, allowed: Attribute[] = ATTRIBUTES): Attribute[] {
  const n = Math.min(stepCountForLevel(level), allowed.length)
  const inOrder = ATTRIBUTES_BY_OBVIOUSNESS.filter((a) => allowed.includes(a))

  // Levels 1 and 2 never use rotation. It is the subtlest attribute here, and a
  // preview showed a level-1 sequence turning four circles by 45°, which is a
  // fair question and an unreadable one. Ruling it out is more reliable than
  // ordering it last, because a short `allowed` list can promote it back up.
  const gentle = inOrder.filter((a) => a !== 'rotation')
  if (level === 1) return rng.sample(gentle.length ? gentle.slice(0, 2) : inOrder, n)
  if (level === 2) return rng.sample(gentle.length ? gentle.slice(0, 3) : inOrder, n)
  if (level >= 4 && allowed.includes('rotation')) {
    const rest = rng.sample(allowed.filter((a) => a !== 'rotation'), n - 1)
    return rng.shuffle(['rotation', ...rest])
  }
  return rng.sample(allowed, n)
}

/**
 * Move the base figure so a run of `steps` applications of `rule` never wraps a
 * bounded attribute.
 *
 * Cyclic attributes are left alone: wrapping is the pattern there. For size and
 * count, the starting value is pulled to whichever end of the range the rule is
 * moving away from, so the whole run fits. When the run is simply longer than
 * the range (four counts cannot cover five increasing positions), it gives up
 * and returns the figure unchanged; callers avoid that case by not offering
 * bounded attributes for long runs.
 */
function fitBaseToRun(base: Figure, rule: Rule, steps: number, level: Level): Figure {
  const bounded = boundedAt(level)
  let out = base
  for (const step of rule) {
    if (!bounded.includes(step.attribute)) continue
    const domain = DOMAINS[step.attribute] as readonly unknown[]
    const span = step.delta * steps
    if (Math.abs(span) > domain.length - 1) continue // cannot fit; leave as is
    const startIndex = span >= 0 ? 0 : domain.length - 1
    out = { ...out, [step.attribute]: domain[startIndex] } as Figure
  }
  return out
}

/**
 * Attributes usable as a progression over `steps` positions at this level.
 *
 * An attribute qualifies if it may wrap at this level, or if its range is long
 * enough to hold the whole run without wrapping.
 */
function attributesThatFit(steps: number, level: Level): Attribute[] {
  const bounded = boundedAt(level)
  return ATTRIBUTES.filter((a) => {
    if (!bounded.includes(a)) return true
    return (DOMAINS[a] as readonly unknown[]).length - 1 >= steps
  })
}

/** Step size. Level 1 and 2 move one position; harder levels may jump two. */
function deltaForLevel(level: Level, attribute: Attribute, rng: Rng): number {
  const sign = rng.chance(0.5) ? 1 : -1
  if (level <= 2) return sign
  // Rotation by two positions is 90°, which reads more cleanly than 45°.
  if (attribute === 'rotation') return sign * (rng.chance(0.6) ? 2 : 1)
  return sign * (rng.chance(0.75) ? 1 : 2)
}

function buildRule(level: Level, rng: Rng, allowed: Attribute[] = ATTRIBUTES): Rule {
  return attributesForLevel(level, rng, allowed).map((attribute) => ({
    attribute,
    delta: deltaForLevel(level, attribute, rng),
  }))
}

function randomFigure(rng: Rng): Figure {
  return {
    kind: rng.pick(SHAPE_KINDS),
    size: rng.pick(SIZES),
    fill: rng.pick(FILLS),
    rotation: rng.pick(ROTATIONS),
    count: rng.pick(COUNTS),
  }
}

// ── Distractors ──────────────────────────────────────────────────────────────

/**
 * Build wrong options by breaking one part of the rule at a time.
 *
 * Each candidate is right about everything except one thing, which is what makes
 * a distractor tempting instead of obviously silly. Candidates are tried in
 * order and the first distinct ones win, so the strongest distractors are the
 * ones that survive.
 */
function distractorCandidates(
  base: Figure,
  rule: Rule,
  times: number,
  rng: Rng,
): Figure[] {
  const out: Figure[] = []

  // Rule applied one step too few, and one too many. The classic near-miss.
  out.push(applyRule(base, rule, times - 1))
  out.push(applyRule(base, rule, times + 1))

  // One step of the rule reversed, the rest correct.
  for (let i = 0; i < rule.length; i++) {
    const flipped = rule.map((s, j) => (i === j ? { ...s, delta: -s.delta } : s))
    out.push(applyRule(base, flipped, times))
  }

  // One step of the rule ignored, the rest correct.
  if (rule.length > 1) {
    for (let i = 0; i < rule.length; i++) {
      out.push(applyRule(base, rule.filter((_, j) => j !== i), times))
    }
  }

  // Correct answer with one unrelated attribute nudged.
  const answer = applyRule(base, rule, times)
  for (const attribute of rng.shuffle(ATTRIBUTES)) {
    out.push(advance(answer, attribute, 1))
  }

  return out
}

/**
 * Assemble the option list: the correct figure plus `wanted - 1` distinct
 * distractors, shuffled.
 *
 * If the candidates run out (small domains can collide), it falls back to
 * nudging random attributes until the list is full. It cannot loop forever: the
 * attribute space is 6 x 3 x 4 x 8 x 4 = 2,304 figures, far more than the four
 * needed.
 */
function buildOptions(
  correct: Figure,
  candidates: Figure[],
  wanted: number,
  rng: Rng,
): { options: Figure[]; correctIndex: number } {
  // Dedupe on the VISUAL key, not the data. Two options that render identically
  // would give a child two right answers, and the marking would look arbitrary.
  const seen = new Set([visualKey(correct)])
  const chosen: Figure[] = []

  for (const c of candidates) {
    if (chosen.length >= wanted - 1) break
    const key = visualKey(c)
    if (seen.has(key)) continue
    seen.add(key)
    chosen.push(c)
  }

  let guard = 0
  while (chosen.length < wanted - 1 && guard++ < 200) {
    const nudged = advance(rng.pick(chosen.length ? chosen : [correct]), rng.pick(ATTRIBUTES), rng.chance(0.5) ? 1 : -1)
    const key = visualKey(nudged)
    if (seen.has(key)) continue
    seen.add(key)
    chosen.push(nudged)
  }

  const options = rng.shuffle([correct, ...chosen])
  return { options, correctIndex: options.findIndex((o) => figuresEqual(o, correct)) }
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Reject an item that is ambiguous, malformed, or trivially readable.
 *
 * This is the safety net the whole product rests on, so it checks the boring
 * things too. Returns null when the item is fine, or a reason string.
 */
export function validateItem(item: ReasoningItem): string | null {
  const { options, correctIndex } = item

  if (options.length < 4) return 'fewer than 4 options'
  if (correctIndex < 0 || correctIndex >= options.length) return 'correctIndex out of range'

  // Visual, not structural. Two options that render the same picture give the
  // child two right answers.
  const keys = options.map(visualKey)
  if (new Set(keys).size !== keys.length) return 'two options look identical'

  // The stimulus has to show the rule happening. A sequence of four identical
  // pictures asks nothing, and it happens whenever a rule turns a shape that is
  // symmetric under that turn.
  const shown = stimulusFigures(item)
  if (shown.length >= 2 && new Set(shown.map(visualKey)).size === 1) {
    return 'every figure shown looks the same'
  }

  if (item.type === 'odd_one_out') {
    // An odd-one-out is only fair when EXACTLY ONE attribute splits the figures
    // four-against-one. Two such attributes means two defensible answers, and
    // the child who picks the other one is not wrong.
    const splits = ATTRIBUTES.filter((a) => oddOneOutIndex(options, a) !== null)
    if (splits.length === 0) return 'no attribute singles out an odd one'
    if (splits.length > 1) return `ambiguous: ${splits.join(' and ')} both single one out`
    const idx = oddOneOutIndex(options, splits[0])
    if (idx !== correctIndex) return 'the odd one is not the answer'
  }

  return null
}

/** The figures a child can actually see in the stimulus. */
function stimulusFigures(item: ReasoningItem): Figure[] {
  switch (item.stimulus.kind) {
    case 'sequence':
      return item.stimulus.figures
    case 'matrix':
      return item.stimulus.grid.flat().filter((c): c is Figure => c !== null)
    case 'analogy':
      return [item.stimulus.a, item.stimulus.b, item.stimulus.c]
    case 'odd_one_out':
      return []
  }
}

/**
 * The value of `attribute` as a child perceives it.
 *
 * Only rotation differs from the stored value, and only because a symmetric
 * shape hides part of its rotation. Without this, four circles at four rotations
 * would count as "four different values" while looking identical.
 */
function perceivedValue(f: Figure, attribute: Attribute): unknown {
  return attribute === 'rotation' ? effectiveRotation(f) : f[attribute]
}

/**
 * If exactly one figure differs from the other four on `attribute`, return its
 * index. Otherwise null.
 */
function oddOneOutIndex(figures: Figure[], attribute: Attribute): number | null {
  const counts = new Map<unknown, number[]>()
  figures.forEach((f, i) => {
    const v = perceivedValue(f, attribute)
    const list = counts.get(v)
    if (list) list.push(i)
    else counts.set(v, [i])
  })
  if (counts.size !== 2) return null
  let lone: number | null = null
  let majority = 0
  for (const [, idxs] of counts) {
    if (idxs.length === 1) lone = idxs[0]
    else majority = idxs.length
  }
  return lone !== null && majority === figures.length - 1 ? lone : null
}

// ── The four generators ──────────────────────────────────────────────────────

const SEQUENCE_SHOWN = 4

function generateSequence(level: Level, seed: string, rng: Rng): ReasoningItem {
  // Five positions, so only attributes with room for four steps may progress.
  // In practice that is the cyclic ones; size and count stay constant here and
  // do their work in matrices and analogies, whose runs are short.
  const rule = buildRule(level, rng, attributesThatFit(SEQUENCE_SHOWN, level))
  const base = fitBaseToRun(randomFigure(rng), rule, SEQUENCE_SHOWN, level)
  const figures = Array.from({ length: SEQUENCE_SHOWN }, (_, i) => applyRule(base, rule, i))
  const correct = applyRule(base, rule, SEQUENCE_SHOWN)
  const { options, correctIndex } = buildOptions(
    correct,
    distractorCandidates(base, rule, SEQUENCE_SHOWN, rng),
    4,
    rng,
  )
  return {
    type: 'sequence',
    level,
    seed,
    prompt: PROMPTS.sequence,
    stimulus: { kind: 'sequence', figures },
    options,
    correctIndex,
  }
}

function generateMatrix(level: Level, seed: string, rng: Rng): ReasoningItem {
  // A matrix run is 3 wide and 3 deep, so 2 steps each way. Size (3 values) and
  // count (4) both fit that, which is why they are allowed here and not in a
  // sequence.
  const rowRule = buildRule(level, rng, attributesThatFit(2, level))
  // The column rule must act on different attributes, otherwise the two rules
  // fight over the same attribute and the grid stops being readable.
  const used = new Set(rowRule.map((s) => s.attribute))
  const colAttributes = ATTRIBUTES.filter((a) => !used.has(a))
  const colRule: Rule =
    colAttributes.length > 0
      ? rng
          .sample(colAttributes, level >= 5 ? Math.min(2, colAttributes.length) : 1)
          .map((attribute) => ({ attribute, delta: deltaForLevel(level, attribute, rng) }))
      : [{ attribute: 'rotation', delta: 2 }]

  // Fit both runs, so neither the rows nor the columns wrap a bounded attribute
  // and turn a readable grid into a jumble.
  const base = fitBaseToRun(fitBaseToRun(randomFigure(rng), rowRule, 2, level), colRule, 2, level)

  const cell = (r: number, c: number) => applyRule(applyRule(base, rowRule, c), colRule, r)

  const grid: (Figure | null)[][] = [0, 1, 2].map((r) => [0, 1, 2].map((c) => cell(r, c)))
  const correct = cell(2, 2)
  grid[2][2] = null

  // The strongest distractors in a matrix are its own neighbours: the child who
  // followed the row but forgot the column lands exactly on cell(1,2).
  const candidates = [cell(1, 2), cell(2, 1), cell(1, 1), cell(0, 2), cell(2, 0)].concat(
    distractorCandidates(cell(2, 1), rowRule, 1, rng),
  )

  const { options, correctIndex } = buildOptions(correct, candidates, 4, rng)
  return {
    type: 'matrix',
    level,
    seed,
    prompt: PROMPTS.matrix,
    stimulus: { kind: 'matrix', grid },
    options,
    correctIndex,
  }
}

function generateAnalogy(level: Level, seed: string, rng: Rng): ReasoningItem {
  const rule = buildRule(level, rng)
  const a = randomFigure(rng)
  const b = applyRule(a, rule, 1)
  // C should be visibly a different starting point, or the analogy collapses
  // into "spot the same picture".
  let c = randomFigure(rng)
  let guard = 0
  while (figuresEqual(c, a) && guard++ < 20) c = randomFigure(rng)

  const correct = applyRule(c, rule, 1)
  const candidates = [
    c, // the rule not applied at all
    applyRule(c, rule, 2), // applied twice
    applyRule(c, rule, -1), // applied backwards
    ...distractorCandidates(c, rule, 1, rng),
  ]
  const { options, correctIndex } = buildOptions(correct, candidates, 4, rng)
  return {
    type: 'analogy',
    level,
    seed,
    prompt: PROMPTS.analogy,
    stimulus: { kind: 'analogy', a, b, c },
    options,
    correctIndex,
  }
}

const ODD_ONE_OUT_COUNT = 5

/**
 * Build an odd-one-out.
 *
 * Construction: every figure is identical except on the rule attribute, where
 * four share a value and one differs. Identical-everywhere-else is what keeps it
 * unambiguous, because an attribute all five share cannot single anyone out.
 *
 * Higher levels add a decoy attribute that varies across all five WITHOUT ever
 * landing on a four-one split, so the grid looks busy while still having exactly
 * one defensible answer. `validateItem` proves that, rather than trusting it.
 */
/**
 * Attributes usable as the "decoy" that makes the four matching figures look
 * different from each other.
 *
 * Rotation is excluded on purpose. It is the one attribute whose visible effect
 * depends on the shape, so a rotation decoy silently does nothing on circles and
 * squares and hands the child two identical pictures.
 */
const DECOY_ATTRIBUTES: Attribute[] = ['kind', 'fill', 'count']

function generateOddOneOut(level: Level, seed: string, rng: Rng): ReasoningItem {
  const pool = level <= 2 ? ATTRIBUTES_BY_OBVIOUSNESS.slice(0, 3) : ATTRIBUTES
  const ruleAttribute = rng.pick(pool)
  const domain = DOMAINS[ruleAttribute] as readonly unknown[]
  const [shared, odd] = rng.sample(domain, 2)

  const template = randomFigure(rng)
  const oddIndex = rng.int(0, ODD_ONE_OUT_COUNT - 1)

  const figures: Figure[] = Array.from({ length: ODD_ONE_OUT_COUNT }, (_, i) => ({
    ...template,
    [ruleAttribute]: i === oddIndex ? odd : shared,
  })) as Figure[]

  // Make the four matching figures visibly different from one another.
  //
  // Without this they are five copies of one picture with one changed, which is
  // not what these items look like and, worse, makes four options identical.
  // Giving each figure its own decoy value fixes both. Four or more distinct
  // decoy values across five figures also guarantees the decoy itself can never
  // form a four-against-one split, so it cannot become a second right answer.
  const decoy = rng.pick(DECOY_ATTRIBUTES.filter((a) => a !== ruleAttribute))
  const decoyValues = rng.shuffle(DOMAINS[decoy] as readonly unknown[])
  for (let i = 0; i < figures.length; i++) {
    figures[i] = { ...figures[i], [decoy]: decoyValues[i % decoyValues.length] } as Figure
  }

  // Higher levels add a second decoy so the row looks busy. Same rule: enough
  // distinct values that it cannot single anybody out.
  if (level >= 4) {
    const second = DECOY_ATTRIBUTES.filter((a) => a !== ruleAttribute && a !== decoy)
    if (second.length > 0) {
      const attr = rng.pick(second)
      const values = rng.shuffle(DOMAINS[attr] as readonly unknown[])
      for (let i = 0; i < figures.length; i++) {
        figures[i] = { ...figures[i], [attr]: values[(i + 1) % values.length] } as Figure
      }
    }
  }

  return {
    type: 'odd_one_out',
    level,
    seed,
    prompt: PROMPTS.odd_one_out,
    stimulus: { kind: 'odd_one_out' },
    options: figures,
    correctIndex: oddIndex,
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

const GENERATORS: Record<
  ReasoningItemType,
  (level: Level, seed: string, rng: Rng) => ReasoningItem
> = {
  sequence: generateSequence,
  matrix: generateMatrix,
  analogy: generateAnalogy,
  odd_one_out: generateOddOneOut,
}

/** How many resamples before we admit defeat on a seed. */
const MAX_ATTEMPTS = 40

/**
 * Generate one item. Deterministic: the same (type, level, seed) always returns
 * the same item, which is what lets an attempt store a seed instead of content.
 *
 * If a draw produces an ambiguous or malformed item, it resamples with a derived
 * seed rather than shipping it. Throwing after MAX_ATTEMPTS is deliberate: a
 * seed that cannot produce a valid item is a bug in a generator, and it should
 * surface loudly in a test rather than quietly serve a broken question to a
 * child.
 */
export function generateItem(type: ReasoningItemType, level: Level, seed: string): ReasoningItem {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attemptSeed = attempt === 0 ? seed : `${seed}#${attempt}`
    const item = GENERATORS[type](level, seed, new Rng(`${type}:${level}:${attemptSeed}`))
    if (validateItem(item) === null) return item
  }
  throw new Error(`Could not generate a valid ${type} item at level ${level} from seed "${seed}"`)
}
