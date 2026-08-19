/**
 * Decifer Reasoning Check — server-side flow.
 *
 * The whole public funnel: start an anonymous attempt, serve one item at a time,
 * mark each answer, and unlock the report in exchange for a parent's email.
 * Scope: docs/REASONING_TEST_SCOPE.md.
 *
 * ONE ITEM AT A TIME, AND WHY. The test is adaptive, so item N+1 cannot exist
 * until answer N is known. That is not a limitation, it is the point: the level
 * of the next question is derived from the answers already stored, which means a
 * reload, a retry, or a double-tap all regenerate exactly the same question.
 *
 * NOTHING IS STORED THAT IS NOT A SEED. An answer row keeps (item_type, level,
 * seed), and generateItem() turns those three back into the identical question
 * whenever it is needed. So the correct answer never reaches the browser, there
 * is no content table, and a bug report is exactly reproducible.
 *
 * KNOWN LIMIT: a seed means what the CURRENT generate.ts says it means. Deploy a
 * change to a generator while somebody is mid-test and the question they are
 * looking at can be marked against the new version of that seed. The blast
 * radius is one answer on one in-flight attempt, and a finished report is
 * unaffected because type_results is denormalised at the end. Storing a
 * generator version per answer would close it; that is not worth the column
 * until this test decides something.
 *
 * PRIVACY (Children's Code, UAE Child Digital Safety Law 26/2025):
 *   - An attempt holds no personal data. No name, no date of birth, no school.
 *     `age_band` is a band, and it does not change the test.
 *   - The one personal field in the feature is the PARENT's email, given
 *     knowingly in exchange for the report.
 *   - Nothing here writes to a child's learning record.
 *
 * Server-only. Never import from a client component.
 */

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  generateItem,
  ITEM_TYPE_LABELS,
  MAX_LEVEL,
  type Level,
  type ReasoningItemType,
  type Stimulus,
} from './generate'
import { describeFigure, type Figure } from './shapes'
import {
  levelAfter,
  planTypes,
  seedFor,
  TOTAL_ITEMS,
  type AgeBand,
} from './plan'
import {
  buildPracticeSteps,
  buildTeaser,
  scoreReasoning,
  slowestType,
  type AnsweredItem,
  type PracticeStep,
  type ReasoningResult,
  type ReasoningTeaser,
  type TypeResult,
} from './score'

export { isValidEmail } from '@/lib/valid-email'
export { MAX_LEVEL }

/** What the browser is given for one question. Carries no hint of the answer. */
export interface ReasoningQuestionView {
  /** 0-based. */
  position: number
  total: number
  type: ReasoningItemType
  typeLabel: string
  prompt: string
  stimulus: Stimulus
  options: { figure: Figure; description: string }[]
}

/**
 * The level is DELIBERATELY absent from this view.
 *
 * It would leak nothing about the answer, but a child watching a number fall
 * from 4 to 3 to 2 mid-test learns only that they are failing. The ladder is a
 * measurement device, not feedback.
 */

// ── Building an item ─────────────────────────────────────────────────────────

/** Just enough of a stored answer to replay the ladder. */
interface PriorAnswer {
  item_type: ReasoningItemType
  was_correct: boolean
}

interface PlannedItem {
  type: ReasoningItemType
  level: Level
  seed: string
}

/**
 * Work out which question sits at `position`, from the attempt token and every
 * answer given before it.
 *
 * `prior` must be in position order and must contain only answers BEFORE this
 * position. Answers are written strictly in sequence, so in practice that is
 * simply every answer stored so far.
 */
function planItem(token: string, position: number, prior: PriorAnswer[]): PlannedItem {
  const type = planTypes(token)[position]
  const sameType = prior.filter((a) => a.item_type === type).map((a) => a.was_correct)
  return { type, level: levelAfter(sameType), seed: seedFor(token, position) }
}

function toView(planned: PlannedItem, position: number): ReasoningQuestionView {
  const item = generateItem(planned.type, planned.level, planned.seed)
  return {
    position,
    total: TOTAL_ITEMS,
    type: item.type,
    typeLabel: ITEM_TYPE_LABELS[item.type],
    prompt: item.prompt,
    stimulus: item.stimulus,
    // The description travels with the figure so the client never has to import
    // the shape vocabulary to label a button for a screen reader.
    options: item.options.map((figure) => ({ figure, description: describeFigure(figure) })),
  }
}

// ── Starting and running an attempt ──────────────────────────────────────────

export interface RunningAttempt {
  token: string
  question: ReasoningQuestionView
}

export type AttemptStep = RunningAttempt | { token: string; done: true }

export function isDone(step: AttemptStep): step is { token: string; done: true } {
  return 'done' in step
}

/** Start an attempt and hand back its first question. */
export async function startAttempt(ageBand: AgeBand): Promise<RunningAttempt> {
  const attempt = await prisma.reasoningAttempt.create({
    data: { age_band: ageBand },
    select: { token: true },
  })
  return { token: attempt.token, question: toView(planItem(attempt.token, 0, []), 0) }
}

/**
 * The question the attempt is currently on.
 *
 * This is what a reload calls. It regenerates rather than reads, so the child
 * gets the same shapes in the same option order they were looking at before.
 */
export async function currentStep(token: string): Promise<AttemptStep | null> {
  const attempt = await prisma.reasoningAttempt.findUnique({
    where: { token },
    select: {
      finished_at: true,
      answers: {
        orderBy: { position: 'asc' },
        select: { item_type: true, was_correct: true },
      },
    },
  })
  if (!attempt) return null
  if (attempt.finished_at || attempt.answers.length >= TOTAL_ITEMS) return { token, done: true }

  const position = attempt.answers.length
  return { token, question: toView(planItem(token, position, attempt.answers), position) }
}

/**
 * Mark one answer and return the next question, or `done`.
 *
 * Marking regenerates the item from its seed and compares indexes, so the
 * browser is never told which option was right — not before the answer and not
 * after it.
 *
 * Idempotent in two layers. A `position` that is not the one the attempt is
 * waiting on writes nothing and simply returns the current question, which
 * covers a retried request and a stale tab. A genuine race between two
 * simultaneous posts is caught by the unique index on (attempt_id, position),
 * and handled the same way. Without that, a double-tap would move the adaptive
 * ladder twice on one answer.
 */
export async function answerQuestion(
  token: string,
  position: number,
  chosenIndex: number | null,
  timeMs: number | null,
): Promise<AttemptStep | null> {
  const attempt = await prisma.reasoningAttempt.findUnique({
    where: { token },
    select: {
      id: true,
      finished_at: true,
      answers: {
        orderBy: { position: 'asc' },
        select: { item_type: true, was_correct: true },
      },
    },
  })
  if (!attempt) return null
  if (attempt.finished_at) return { token, done: true }

  const expected = attempt.answers.length
  if (expected >= TOTAL_ITEMS) {
    await finishAttempt(attempt.id)
    return { token, done: true }
  }
  if (position !== expected) {
    // Not the question this attempt is waiting on. Write nothing.
    return { token, question: toView(planItem(token, expected, attempt.answers), expected) }
  }

  const planned = planItem(token, position, attempt.answers)
  const item = generateItem(planned.type, planned.level, planned.seed)
  // A skipped question counts as wrong, not as absent. Letting a child skip the
  // hard ones for free would push the ladder up on no evidence.
  const correct = chosenIndex !== null && chosenIndex === item.correctIndex

  try {
    await prisma.reasoningAnswer.create({
      data: {
        attempt_id: attempt.id,
        position,
        item_type: planned.type,
        level: planned.level,
        seed: planned.seed,
        chosen_index: chosenIndex,
        was_correct: correct,
        time_ms: timeMs,
      },
    })
  } catch (err) {
    // P2002 = another request already answered this position. Fall through to
    // whatever the attempt is on now rather than scoring the same item twice.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err
    return (await currentStep(token)) ?? { token, done: true }
  }

  const answeredCount = expected + 1
  if (answeredCount >= TOTAL_ITEMS) {
    await finishAttempt(attempt.id)
    return { token, done: true }
  }

  const prior = [...attempt.answers, { item_type: planned.type, was_correct: correct }]
  return {
    token,
    question: toView(planItem(token, answeredCount, prior), answeredCount),
  }
}

/**
 * Score the whole paper and store the result.
 *
 * Re-read from the answer rows rather than accumulated in memory, so the stored
 * result always matches what is actually on disk. Safe to call twice: it writes
 * the same values.
 */
async function finishAttempt(attemptId: string): Promise<void> {
  const rows = await prisma.reasoningAnswer.findMany({
    where: { attempt_id: attemptId },
    orderBy: { position: 'asc' },
    select: { item_type: true, level: true, was_correct: true, time_ms: true },
  })

  const answers: AnsweredItem[] = rows.map((r) => ({
    type: r.item_type,
    level: r.level as Level,
    correct: r.was_correct,
    timeMs: r.time_ms,
  }))
  const result = scoreReasoning(answers)

  await prisma.reasoningAttempt.update({
    where: { id: attemptId },
    data: {
      finished_at: new Date(),
      raw_score: result.rawScore,
      total_items: result.totalItems,
      level_reached: result.levelReached,
      // Prisma types JSON columns structurally; the shape is guaranteed by
      // scoreReasoning(), which is the only thing that ever writes here.
      type_results: result.types as unknown as Prisma.InputJsonValue,
    },
  })
}

// ── The result page ──────────────────────────────────────────────────────────

export interface ReasoningAttemptView {
  token: string
  finished: boolean
  maxLevel: number
  teaser: ReasoningTeaser
  /** Null until a parent has given their email. This is the gate. */
  report: {
    types: TypeResult[]
    rawScore: number
    totalItems: number
    levelReached: number
    practice: PracticeStep[]
    /** The type they took longest over. Null when no timings were kept. */
    slowestTypeLabel: string | null
  } | null
}

function resultFromRow(row: {
  type_results: unknown
  raw_score: number | null
  total_items: number | null
  level_reached: number | null
}): ReasoningResult {
  return {
    types: (row.type_results as unknown as TypeResult[]) ?? [],
    rawScore: row.raw_score ?? 0,
    totalItems: row.total_items ?? 0,
    levelReached: row.level_reached ?? 0,
  }
}

/**
 * Load a finished attempt for the result page.
 *
 * The teaser always comes back. The report comes back only when a lead exists
 * and has not been deleted. That single condition IS the email gate, and it is
 * enforced here on the server so the gated content never reaches the browser for
 * a CSS or devtools trick to reveal.
 */
export async function getAttemptView(token: string): Promise<ReasoningAttemptView | null> {
  const attempt = await prisma.reasoningAttempt.findUnique({
    where: { token },
    select: {
      token: true,
      finished_at: true,
      raw_score: true,
      total_items: true,
      level_reached: true,
      type_results: true,
      lead: { select: { id: true, deleted_at: true } },
    },
  })
  if (!attempt || !attempt.finished_at) return null

  const result = resultFromRow(attempt)
  const unlocked = !!attempt.lead && !attempt.lead.deleted_at

  const slowest = slowestType(result.types)

  return {
    token: attempt.token,
    finished: true,
    maxLevel: MAX_LEVEL,
    teaser: buildTeaser(result),
    report: unlocked
      ? {
          types: result.types,
          rawScore: result.rawScore,
          totalItems: result.totalItems,
          levelReached: result.levelReached,
          practice: buildPracticeSteps(result),
          slowestTypeLabel: slowest ? slowest.label : null,
        }
      : null,
  }
}

/**
 * Record the parent's email and unlock the report.
 *
 * Re-submitting on the same attempt updates the row rather than adding another,
 * and clears any earlier deletion, because giving the address again is a fresh
 * act of consent.
 */
export async function unlockReport(
  token: string,
  email: string,
  source?: string,
): Promise<{ view: ReasoningAttemptView; shouldSend: boolean } | null> {
  const attempt = await prisma.reasoningAttempt.findUnique({
    where: { token },
    select: {
      id: true,
      finished_at: true,
      lead: { select: { parent_email: true, deleted_at: true } },
    },
  })
  if (!attempt || !attempt.finished_at) return null

  const clean = email.trim().toLowerCase()

  // Send only when this address is new to this attempt.
  //
  // The dull reason: a parent who reloads or double-taps should not get the same
  // report twice. The important one: without this, one finished token could be
  // replayed with a thousand different addresses and we would send a thousand
  // emails from our own domain. The report is harmless content, so this is not a
  // phishing vector, but it is a fast way to wreck a sending reputation. The
  // route also caps unlocks per token.
  const shouldSend = attempt.lead?.parent_email !== clean || !!attempt.lead?.deleted_at

  await prisma.reasoningLead.upsert({
    where: { attempt_id: attempt.id },
    create: { attempt_id: attempt.id, parent_email: clean, source: source ?? null },
    update: { parent_email: clean, consented_at: new Date(), deleted_at: null },
  })

  const view = await getAttemptView(token)
  if (!view) return null
  return { view, shouldSend }
}

/**
 * Honour the one-click delete link in the report email.
 *
 * A tombstone rather than a hard delete: the row stays with the address cleared
 * and `deleted_at` set, so no later cron can email the address again. Returns
 * false when there was nothing to delete, which the page reports honestly rather
 * than claiming a deletion that did not happen.
 */
export async function deleteLead(token: string): Promise<boolean> {
  const attempt = await prisma.reasoningAttempt.findUnique({
    where: { token },
    select: { id: true, lead: { select: { id: true, deleted_at: true } } },
  })
  if (!attempt?.lead || attempt.lead.deleted_at) return false

  await prisma.reasoningLead.update({
    where: { id: attempt.lead.id },
    data: { deleted_at: new Date(), parent_email: '' },
  })
  return true
}
