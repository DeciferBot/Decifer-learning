/**
 * Decifer Skills Check — building a check from the live question bank.
 *
 * The database half of lib/skills-check/plan.ts. This module reads topics and
 * questions, hands the pools to the pure planner, and writes the resulting item
 * list into skill_checks + skill_check_items.
 *
 * PUBLISHED ONLY. Every read of quiz_questions here filters
 * `status = 'published'` (CLAUDE.md §16.3). A Skills Check is served to the
 * public with no login at all, so this is the strictest place in the product for
 * that rule, not the loosest.
 *
 * A built check is NOT live. `is_published` stays false until every item has
 * been hand-checked once (docs/SKILLS_CHECK_SCOPE.md §11). Building is cheap and
 * repeatable; publishing is a deliberate act.
 *
 * Server-only: imports Prisma. Never import this from a client component.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  planCheck,
  isSuitableForPublicCheck,
  hasUsableAnswer,
  type TopicPool,
  type CheckPlan,
} from './plan'
import { buildOptions, MIN_OPTIONS } from './shuffle'

/** True when a question can render as a fair multiple choice. */
function hasEnoughOptions(correctAnswer: string, distractors: unknown): boolean {
  return buildOptions(correctAnswer, distractors, 'probe').length >= MIN_OPTIONS
}

/** Year group labels are 'year-1' … 'year-11'. Returns null for anything else. */
export function yearNumberFromLabel(label: string): number | null {
  const m = /^year-(\d+)$/.exec(label)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/** The label one step above or below, or null past either end of the range. */
export function adjacentYearLabel(label: string, offset: number): string | null {
  const n = yearNumberFromLabel(label)
  if (n === null) return null
  const next = n + offset
  if (next < 1 || next > 11) return null
  return `year-${next}`
}

/**
 * Load every published question for one subject and year, grouped by topic and
 * tier, ready for the planner.
 *
 * Returns [] when the year does not exist, which is what makes Year 1 (no year
 * below) and Year 11 (no year above) work without a special case.
 */
export async function loadTopicPools(
  subjectId: string,
  yearLabel: string | null,
): Promise<TopicPool[]> {
  if (!yearLabel) return []

  const yearGroup = await prisma.yearGroup.findUnique({
    where: { label: yearLabel },
    select: { id: true },
  })
  if (!yearGroup) return []

  const topics = await prisma.topic.findMany({
    where: {
      subject_id: subjectId,
      year_group_id: yearGroup.id,
      is_published: true,
    },
    select: {
      id: true,
      title: true,
      order_index: true,
      quiz_questions: {
        // The published-only gate. Do not relax this.
        where: { status: 'published' },
        select: {
          id: true,
          tier: true,
          question_text: true,
          correct_answer: true,
          distractors: true,
        },
        orderBy: { id: 'asc' }, // stable, so a rebuild picks the same items
      },
    },
    orderBy: { order_index: 'asc' },
  })

  return topics.map((t) => {
    const usable = t.quiz_questions.filter(
      (q) =>
        // Screen heavy themes out of a public check. See isSuitableForPublicCheck.
        isSuitableForPublicCheck(q.question_text) &&
        // And drop rows whose stored answer is a bare option label like "C",
        // which would render as four meaningless letters.
        hasUsableAnswer(q.correct_answer, q.distractors) &&
        // And drop anything that cannot render as a fair multiple choice. A row
        // whose `distractors` JSON is empty, malformed, or duplicates the
        // correct answer would show a child a single button to press. Checking
        // it here keeps it out of the pool entirely, rather than surfacing mid-test.
        hasEnoughOptions(q.correct_answer, q.distractors),
    )
    return {
      topicId: t.id,
      title: t.title,
      byTier: {
        sprout: usable.filter((q) => q.tier === 'sprout').map((q) => q.id),
        explorer: usable.filter((q) => q.tier === 'explorer').map((q) => q.id),
        lightning: usable.filter((q) => q.tier === 'lightning').map((q) => q.id),
      },
      // Lets the planner keep two ways of asking the same thing out of one check.
      texts: Object.fromEntries(usable.map((q) => [q.id, q.question_text])),
    }
  })
}

export interface BuiltCheck {
  subjectId: string
  subjectName: string
  yearGroupId: string
  yearLabel: string
  slug: string
  plan: CheckPlan
}

/** URL slug for a check, e.g. 'maths-year-4'. */
export function checkSlug(subjectName: string, yearLabel: string): string {
  return `${subjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${yearLabel}`
}

/**
 * Plan a check for one subject and year without writing anything.
 *
 * Use this to inspect what a check WOULD contain before creating it. The
 * hand-check step in scope §11 reads this output.
 */
export async function planCheckForYear(
  subjectName: string,
  yearLabel: string,
): Promise<BuiltCheck | null> {
  const [subject, yearGroup] = await Promise.all([
    prisma.subject.findUnique({ where: { name: subjectName }, select: { id: true, name: true } }),
    prisma.yearGroup.findUnique({ where: { label: yearLabel }, select: { id: true, label: true } }),
  ])
  if (!subject || !yearGroup) return null

  const [atYear, belowYear, aboveYear] = await Promise.all([
    loadTopicPools(subject.id, yearLabel),
    loadTopicPools(subject.id, adjacentYearLabel(yearLabel, -1)),
    loadTopicPools(subject.id, adjacentYearLabel(yearLabel, +1)),
  ])

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    yearGroupId: yearGroup.id,
    yearLabel: yearGroup.label,
    slug: checkSlug(subject.name, yearGroup.label),
    plan: planCheck({ atYear, belowYear, aboveYear }),
  }
}

/**
 * Create or replace a check's item list.
 *
 * Replacing deletes and re-creates every skill_check_items row. Attempts survive
 * (their FK is to skill_checks) and so do answers, but only because
 * skill_check_answers carries its own question, band, strand and position and
 * treats item_id as a nullable convenience. It did not always: while item_id was
 * ON DELETE CASCADE, every rebuild silently deleted every answer the check had
 * ever collected. Do not restore that dependency.
 *
 * It also forces `is_published` back to false, since a new item list has not
 * been hand-checked.
 */
export async function persistCheck(built: BuiltCheck): Promise<{ checkId: string; items: number }> {
  const { subjectId, yearGroupId, slug, plan } = built

  // The upsert runs on its own. It has to, because the item writes below need
  // the check id it returns, and there is no safe way to get that inside a
  // batched transaction.
  //
  // A check row with no items is harmless: `is_published` is false, so nothing
  // serves it, and the next run replaces it.
  const check = await prisma.skillCheck.upsert({
    where: { slug },
    create: {
      slug,
      subject_id: subjectId,
      year_group_id: yearGroupId,
      format: 'strand_sample',
      item_count: plan.items.length,
      is_published: false,
    },
    update: {
      item_count: plan.items.length,
      // A rebuilt item list is unreviewed by definition.
      is_published: false,
    },
    select: { id: true },
  })

  // The item swap must be all or nothing, and it uses the ARRAY form of
  // $transaction rather than the interactive callback form on purpose.
  //
  // DECISIONS.md records that Prisma interactive transactions can silently lose
  // atomicity behind Supabase's PgBouncer pooler in transaction mode, because
  // the pooler may hand a different physical connection to each statement. The
  // array form is sent as one batch on one connection, so it does not have that
  // problem. With the callback form, a failure between the delete and the create
  // would leave a check advertising 20 items and holding none.
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.skillCheckItem.deleteMany({ where: { check_id: check.id } }),
  ]
  if (plan.items.length > 0) {
    writes.push(
      prisma.skillCheckItem.createMany({
        data: plan.items.map((i) => ({
          check_id: check.id,
          question_id: i.questionId,
          position: i.position,
          band: i.band,
          strand_topic_id: i.strandTopicId,
        })),
      }),
    )
  }
  await prisma.$transaction(writes)

  return { checkId: check.id, items: plan.items.length }
}
