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

/**
 * Find a published check by its public URL parts, e.g. ('maths', 'year-4').
 *
 * Returns null when the check does not exist or has not been published, so a
 * page can render a clean 404 rather than an empty check.
 */
export async function getPublishedCheck(
  subjectSlug: string,
  yearLabel: string,
): Promise<CheckSummary | null> {
  const check = await prisma.skillCheck.findFirst({
    where: {
      is_published: true,
      year_group: { label: yearLabel },
      subject: { OR: [{ slug: subjectSlug }, { name: { equals: subjectSlug, mode: 'insensitive' } }] },
    },
    select: {
      id: true,
      slug: true,
      item_count: true,
      subject: { select: { name: true, slug: true } },
      year_group: { select: { label: true } },
    },
  })
  if (!check) return null
  return {
    id: check.id,
    slug: check.slug,
    subjectName: check.subject.name,
    subjectSlug: check.subject.slug ?? check.subject.name.toLowerCase(),
    yearLabel: check.year_group.label,
    itemCount: check.item_count,
  }
}

/** Every published check, for the hub page and the sitemap. */
export async function listPublishedChecks(): Promise<CheckSummary[]> {
  const checks = await prisma.skillCheck.findMany({
    where: { is_published: true },
    select: {
      id: true,
      slug: true,
      item_count: true,
      subject: { select: { name: true, slug: true } },
      year_group: { select: { label: true } },
    },
    orderBy: [{ subject: { name: 'asc' } }, { year_group: { label: 'asc' } }],
  })
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

  const attempt = await prisma.skillCheckAttempt.create({
    data: { check_id: check.id },
    select: { token: true },
  })

  const questions: CheckQuestionView[] = check.items
    // Belt and braces on top of the build-time gate: if an item's question was
    // retired after the check was built, drop it rather than serve it.
    .filter((i) => i.question.status === 'published')
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
      check: {
        select: {
          items: {
            select: {
              id: true,
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
  const answerRows: { attempt_id: string; item_id: string; child_answer: string | null; was_correct: boolean; time_seconds: number | null }[] = []

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

/** Deliberately permissive: reject the obviously-not-an-address, nothing more. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.trim().length <= 254
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
