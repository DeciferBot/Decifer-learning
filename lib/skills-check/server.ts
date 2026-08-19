/**
 * Decifer Skills Check — server-side flow.
 *
 * The whole public funnel lives here: look up a check, start an anonymous
 * attempt, mark it, and unlock the report in exchange for a parent's email.
 * Scope: docs/SKILLS_CHECK_SCOPE.md.
 *
 * PRIVACY POSTURE (Children's Code, UAE Child Digital Safety Law 26/2025):
 *   - An attempt stores no personal data at all. No name, no date of birth, no
 *     school, no IP. Its only handle is a random token.
 *   - The one personal field in the whole feature is the PARENT's email, given
 *     knowingly in exchange for the report.
 *   - Nothing here writes to a child's learning record. A Skills Check never
 *     touches quiz_attempts, session_answers, topic_progress or points.
 *
 * PUBLISHED ONLY: every question read filters `status = 'published'`, and a
 * check is only servable when `is_published` is true, which happens only after
 * its items have been hand-checked (scope §11).
 *
 * Server-only. Never import from a client component.
 */

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withDbRetry } from '@/lib/db-retry'
import { scoreCheck, buildTeaser, type CheckAnswer, type CheckResult, type CheckTeaser } from './score'
import { buildOptions, isCorrectAnswer } from './shuffle'

/** What the browser is given for one question. Carries no hint of the answer. */
export interface CheckQuestionView {
  itemId: string
  position: number
  questionText: string
  options: string[]
}

export interface StartedAttempt {
  token: string
  slug: string
  subjectName: string
  yearLabel: string
  questions: CheckQuestionView[]
}

export interface CheckSummary {
  id: string
  slug: string
  subjectName: string
  subjectSlug: string
  yearLabel: string
  itemCount: number
}

/** Human year label: 'year-4' becomes 'Year 4'. */
export function prettyYear(label: string): string {
  const m = /^year-(\d+)$/.exec(label)
  return m ? `Year ${m[1]}` : label
}

/** Subject as it reads mid-sentence: "Year 4 maths". */
export function prettySubject(name: string): string {
  return name.toLowerCase()
}

// ── The published-check snapshot ─────────────────────────────────────────────
// Every public read of "which checks exist" is served from ONE memoised list
// rather than a query per page. This is the trap recorded in scope §8 and in
// lib/public-curriculum.ts, and the Skills Check pages walked into it: a build
// ran generateStaticParams (1 query) and then getPublishedCheck twice per page,
// once in generateMetadata and once in the component. Across build workers,
// each with its own Prisma client, that raced the curriculum snapshot for a
// pooler capped at pool_size 15 and the export died with
// "(EMAXCONNSESSION) max clients reached in session mode".
//
// There are at most a few dozen checks and the whole row set is tiny, so
// holding it in memory costs nothing and turns the whole build into one query.

const CHECKS_TTL_MS = 60_000
let checksCache: { at: number; data: Promise<CheckSummary[]> } | null = null

async function loadPublishedChecks(): Promise<CheckSummary[]> {
  const checks = await withDbRetry(() => prisma.skillCheck.findMany({
    where: { is_published: true },
    select: {
      id: true,
      slug: true,
      item_count: true,
      subject: { select: { name: true, slug: true } },
      year_group: { select: { label: true } },
    },
    orderBy: [{ subject: { name: 'asc' } }, { year_group: { label: 'asc' } }],
  }))
  return checks.map((c) => ({
    id: c.id,
    slug: c.slug,
    subjectName: c.subject.name,
    subjectSlug: c.subject.slug ?? c.subject.name.toLowerCase(),
    yearLabel: c.year_group.label,
    itemCount: c.item_count,
  }))
}

/**
 * Every published check, for the hub page, the landing pages and the sitemap.
 *
 * Memoised for a minute. Publishing a check is a rare, deliberate act, so a
 * short stale window is harmless, and nothing here can leak an unpublished
 * check: startAttempt re-checks `is_published` against the database before it
 * will serve a single question.
 */
export async function listPublishedChecks(): Promise<CheckSummary[]> {
  const now = Date.now()
  if (!checksCache || now - checksCache.at > CHECKS_TTL_MS) {
    const pending = loadPublishedChecks()
    // Evict a rejected snapshot immediately. We cache the promise, not the
    // value, so without this one transient connection failure would be handed
    // to every caller for the rest of the TTL and a single blip would fail a
    // whole batch of pages.
    pending.catch(() => {
      if (checksCache?.data === pending) checksCache = null
    })
    checksCache = { at: now, data: pending }
  }
  return checksCache.data
}

/**
 * Find a published check by its public URL parts, e.g. ('maths', 'year-4').
 *
 * Served from the snapshot above, so a page costs no query of its own. Returns
 * null when the check does not exist or has not been published, so a page can
 * render a clean 404 rather than an empty check.
 */
export async function getPublishedCheck(
  subjectSlug: string,
  yearLabel: string,
): Promise<CheckSummary | null> {
  const wanted = subjectSlug.toLowerCase()
  const checks = await listPublishedChecks()
  return (
    checks.find(
      (c) =>
        c.yearLabel === yearLabel &&
        // Match on slug or on the subject name, the same two ways the old query
        // did, so a subject with a null slug still resolves by name.
        (c.subjectSlug.toLowerCase() === wanted || c.subjectName.toLowerCase() === wanted),
    ) ?? null
  )
}

/**
 * Start an attempt and return the questions to answer.
 *
 * Options are shuffled per (attempt token + item id), so two children get
 * different orders and one child gets the same order on every reload.
 */
export async function startAttempt(checkId: string): Promise<StartedAttempt | null> {
  const check = await prisma.skillCheck.findFirst({
    where: { id: checkId, is_published: true },
    select: {
      id: true,
      slug: true,
      subject: { select: { name: true } },
      year_group: { select: { label: true } },
      items: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          question: {
            select: { id: true, status: true, question_text: true, correct_answer: true, distractors: true },
          },
        },
      },
    },
  })
  if (!check || check.items.length === 0) return null

  // Belt and braces on top of the build-time gate: if an item's question was
  // retired after the check was built, drop it rather than serve it.
  const servable = check.items.filter((i) => i.question.status === 'published')
  // Filter BEFORE the attempt row is created. Creating it first left a started
  // attempt behind every time a check had nothing servable, and those rows count
  // as started-but-never-finished in the admin funnel while describing a check
  // no child was ever shown.
  if (servable.length === 0) return null

  const attempt = await prisma.skillCheckAttempt.create({
    data: { check_id: check.id },
    select: { token: true },
  })

  const questions: CheckQuestionView[] = servable
    .map((i) => ({
      itemId: i.id,
      position: i.position,
      questionText: i.question.question_text,
      options: buildOptions(i.question.correct_answer, i.question.distractors, `${attempt.token}:${i.id}`),
    }))

  return {
    token: attempt.token,
    slug: check.slug,
    subjectName: check.subject.name,
    yearLabel: check.year_group.label,
    questions,
  }
}

export interface SubmittedAnswer {
  itemId: string
  answer: string | null
  timeSeconds?: number
}

/**
 * Mark an attempt and store the result.
 *
 * Marking is server-side against `quiz_questions.correct_answer`. The browser
 * never sees which option is right, so a child cannot read the answer out of the
 * page source.
 *
 * Idempotent: submitting twice returns the stored result rather than rescoring,
 * so a double-tap or a retried request cannot change a child's outcome.
 */
export async function submitAttempt(
  token: string,
  answers: SubmittedAnswer[],
): Promise<CheckResult | null> {
  const attempt = await prisma.skillCheckAttempt.findUnique({
    where: { token },
    select: {
      id: true,
      finished_at: true,
      raw_score: true,
      total_items: true,
      working_level: true,
      strand_results: true,
      check_id: true,
      check: {
        select: {
          items: {
            select: {
              id: true,
              position: true,
              question_id: true,
              band: true,
              strand_topic_id: true,
              strand: { select: { title: true } },
              question: { select: { status: true, correct_answer: true } },
            },
          },
        },
      },
    },
  })
  if (!attempt) return null

  if (attempt.finished_at) {
    return {
      strands: (attempt.strand_results as unknown as CheckResult['strands']) ?? [],
      workingLevel: attempt.working_level ?? 'towards_year',
      rawScore: attempt.raw_score ?? 0,
      totalItems: attempt.total_items ?? 0,
      bandAccuracy: { below: null, at: null, above: null },
    }
  }

  const given = new Map(answers.map((a) => [a.itemId, a]))

  // Score only the items the child was actually shown.
  //
  // startAttempt drops any item whose question has since been retired, so
  // scoring every item in the check would mark a retired question wrong against
  // a child who was never shown it. The filter has to match startAttempt's
  // exactly. If a question is retired BETWEEN start and submit, this drops it
  // too, which is the safe direction: a missing question is better than a
  // phantom wrong answer.
  const servedItems = attempt.check.items.filter((i) => i.question.status === 'published')

  const scored: CheckAnswer[] = []
  // Each row copies the item's question, check, band, strand and position rather
  // than pointing at the item and stopping there. Rebuilding a check deletes and
  // re-creates every item row, and an answer that leaned on the item went with
  // it. See the comment on SkillCheckAnswer in schema.prisma.
  const answerRows: Prisma.SkillCheckAnswerCreateManyInput[] = []

  for (const item of servedItems) {
    const submitted = given.get(item.id)
    // An unanswered item counts as wrong, not as absent. Skipping the hard ones
    // would otherwise read as "secure".
    const correct = isCorrectAnswer(submitted?.answer, item.question.correct_answer)
    scored.push({
      strandTopicId: item.strand_topic_id,
      strandTitle: item.strand.title,
      band: item.band,
      correct,
    })
    answerRows.push({
      attempt_id: attempt.id,
      item_id: item.id,
      question_id: item.question_id,
      check_id: attempt.check_id,
      band: item.band,
      strand_topic_id: item.strand_topic_id,
      position: item.position,
      child_answer: submitted?.answer ?? null,
      was_correct: correct,
      time_seconds: typeof submitted?.timeSeconds === 'number' ? Math.round(submitted.timeSeconds) : null,
    })
  }

  const result = scoreCheck(scored)

  await prisma.$transaction([
    prisma.skillCheckAnswer.createMany({ data: answerRows, skipDuplicates: true }),
    prisma.skillCheckAttempt.update({
      where: { id: attempt.id },
      data: {
        finished_at: new Date(),
        raw_score: result.rawScore,
        total_items: result.totalItems,
        working_level: result.workingLevel,
        // Prisma types JSON columns structurally; the shape is guaranteed by
        // scoreCheck(), which is the only thing that ever writes here.
        strand_results: result.strands as unknown as Prisma.InputJsonValue,
      },
    }),
  ])

  return result
}

export interface NextStep {
  strandTitle: string
  topicUrl: string | null
}

export interface AttemptView {
  token: string
  finished: boolean
  subjectName: string
  yearLabel: string
  subjectSlug: string
  teaser: CheckTeaser
  /**
   * How many items were actually asked, and how many areas they covered.
   *
   * Above the gate on purpose. Both pages have to say how big the sample was,
   * and neither number gives away anything the teaser does not already say (its
   * gap line already counts the areas). Gating them only got us a page that
   * claimed a fixed twenty questions across four areas whatever the child was
   * really shown.
   */
  totalItems: number
  strandCount: number
  /** Null until a parent has given their email. This is the gate. */
  report: {
    strands: CheckResult['strands']
    rawScore: number
    totalItems: number
    nextSteps: NextStep[]
  } | null
}

/**
 * Load an attempt for the result page.
 *
 * The teaser always comes back. The report comes back only when a lead exists
 * and has not been deleted. That single condition IS the email gate, and it is
 * enforced here on the server so the gated content never reaches the browser
 * for a CSS trick to reveal.
 */
export async function getAttemptView(token: string): Promise<AttemptView | null> {
  const attempt = await prisma.skillCheckAttempt.findUnique({
    where: { token },
    select: {
      token: true,
      finished_at: true,
      raw_score: true,
      total_items: true,
      working_level: true,
      strand_results: true,
      lead: { select: { id: true, deleted_at: true } },
      check: {
        select: {
          subject: { select: { name: true, slug: true } },
          year_group: { select: { label: true } },
        },
      },
    },
  })
  if (!attempt || !attempt.finished_at) return null

  const strands = (attempt.strand_results as unknown as CheckResult['strands']) ?? []
  const result: CheckResult = {
    strands,
    workingLevel: attempt.working_level ?? 'towards_year',
    rawScore: attempt.raw_score ?? 0,
    totalItems: attempt.total_items ?? 0,
    bandAccuracy: { below: null, at: null, above: null },
  }

  const subjectName = attempt.check.subject.name
  const subjectSlug = attempt.check.subject.slug ?? subjectName.toLowerCase()
  const yearLabel = attempt.check.year_group.label
  const teaser = buildTeaser(result, prettyYear(yearLabel), prettySubject(subjectName))

  const unlocked = !!attempt.lead && !attempt.lead.deleted_at

  return {
    token: attempt.token,
    finished: true,
    subjectName,
    subjectSlug,
    yearLabel,
    teaser,
    totalItems: result.totalItems,
    strandCount: strands.length,
    report: unlocked
      ? {
          strands,
          rawScore: result.rawScore,
          totalItems: result.totalItems,
          nextSteps: await buildNextSteps(strands, subjectSlug, yearLabel),
        }
      : null,
  }
}

/**
 * Turn the weakest strands into things a parent can actually do next.
 *
 * Ordered worst first, capped at three. More than three is a to-do list nobody
 * starts. Each links to the public curriculum page for that topic, which needs
 * no account to read.
 */
async function buildNextSteps(
  strands: CheckResult['strands'],
  subjectSlug: string,
  yearLabel: string,
): Promise<NextStep[]> {
  const weakest = [...strands]
    .filter((s) => s.verdict !== 'secure')
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, 3)
  if (weakest.length === 0) return []

  const topics = await prisma.topic.findMany({
    where: { id: { in: weakest.map((s) => s.strandTopicId) } },
    select: { id: true, slug: true },
  })
  const slugById = new Map(topics.map((t) => [t.id, t.slug]))

  return weakest.map((s) => {
    const slug = slugById.get(s.strandTopicId)
    return {
      strandTitle: s.strandTitle,
      topicUrl: slug ? `/curriculum/${subjectSlug}/${yearLabel}/${slug}` : null,
    }
  })
}

// Shared with the Reasoning Check, which has the same gate. Re-exported here so
// the routes that already import it from this module keep working.
export { isValidEmail } from '@/lib/valid-email'

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
): Promise<{ view: AttemptView; shouldSend: boolean } | null> {
  const attempt = await prisma.skillCheckAttempt.findUnique({
    where: { token },
    select: { id: true, finished_at: true, lead: { select: { parent_email: true, deleted_at: true } } },
  })
  if (!attempt || !attempt.finished_at) return null

  const clean = email.trim().toLowerCase()

  // Send only when this address is new to this attempt.
  //
  // Two reasons. The dull one: a parent who reloads or double-taps should not
  // get the same report twice. The important one: without this, one finished
  // token could be replayed with a thousand different addresses and we would
  // send a thousand emails from our own domain. The report is harmless content,
  // so this is not a phishing vector, but it is a fast way to wreck a sending
  // reputation. The route also caps unlocks per token.
  const shouldSend = attempt.lead?.parent_email !== clean || !!attempt.lead?.deleted_at

  await prisma.skillCheckLead.upsert({
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
  const attempt = await prisma.skillCheckAttempt.findUnique({
    where: { token },
    select: { id: true, lead: { select: { id: true, deleted_at: true } } },
  })
  if (!attempt?.lead || attempt.lead.deleted_at) return false

  await prisma.skillCheckLead.update({
    where: { id: attempt.lead.id },
    data: { deleted_at: new Date(), parent_email: '' },
  })
  return true
}
