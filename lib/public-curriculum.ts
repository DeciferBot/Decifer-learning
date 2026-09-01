// Public, SEO-facing curriculum data.
//
// Powers the indexable /curriculum pages. Unlike the child-facing learn store,
// these reads are NOT year-group scoped (a crawler/visitor has no profile) and
// expose ONLY published topic *titles* grouped by year — never questions,
// answers, hints, or lesson bodies. Gated content stays behind auth.
//
// Covers every subject we actually market. History and Geography were missing
// here and had a null subjects.slug, so /curriculum/history and
// /curriculum/geography returned 404 while the homepage and /subjects both
// advertised five subjects — 85 published topics invisible to search. Their
// slugs are now set in the database and listed below.
//
// Order matters: it drives the order subjects appear on /curriculum. Maths,
// English and Science first (Year 1 to GCSE), then History and Geography
// (Year 1 to Year 9), which matches how /subjects describes the offer.
//
// A subject only appears once it has published topics, so adding a slug here
// for an empty subject is harmless — getPublicCurriculumSummary filters it out.

import { prisma } from '@/lib/prisma'
import { withDbRetry } from '@/lib/db-retry'

export const PUBLIC_SUBJECT_SLUGS = ['maths', 'english', 'science', 'history', 'geography'] as const
export type PublicSubjectSlug = (typeof PUBLIC_SUBJECT_SLUGS)[number]

export type PublicSubjectSummary = {
  name: string
  slug: string
  colourToken: string
  topicCount: number
  yearCount: number
}

export type PublicYearGroup = {
  label: string // raw, e.g. "year-7"
  displayLabel: string // "Year 7"
  keyStage: string // "KS3"
  topics: string[] // topic titles, in curriculum order
}

export type PublicSubjectDetail = {
  name: string
  slug: string
  colourToken: string
  topicCount: number
  years: PublicYearGroup[]
}

/**
 * A topic only gets its own indexable page once it has at least this many lessons
 * to show. Below the bar there is nothing to say beyond the title, and a few
 * hundred near-empty pages would do more harm to the site than the extra URLs are
 * worth. 293 of 329 published topics clear it; the rest are still listed on their
 * year page, just not linked to a page of their own.
 */
export const PUBLIC_TOPIC_MIN_UNITS = 4

export type PublicYearTopic = {
  title: string
  slug: string | null
  lessonCount: number
  /** True when this topic clears PUBLIC_TOPIC_MIN_UNITS and has a page to link to. */
  hasPage: boolean
}

export type PublicYearDetail = {
  subjectName: string
  subjectSlug: string
  colourToken: string
  yearLabel: string
  displayLabel: string
  keyStage: string
  topics: PublicYearTopic[]
  lessonCount: number
}

export type PublicTopicDetail = {
  subjectName: string
  subjectSlug: string
  colourToken: string
  yearLabel: string
  displayLabel: string
  keyStage: string
  title: string
  slug: string
  /** Lesson titles in teaching order. Titles only — lesson bodies stay behind auth. */
  lessons: string[]
  previousTopic: { title: string; slug: string } | null
  nextTopic: { title: string; slug: string } | null
  /**
   * Where this page should point rel=canonical. Normally itself, but some topics
   * repeat verbatim across two years of the same key stage — KS1 History and
   * Geography are specified at key-stage level, so "Changes Within Living Memory"
   * is the same six lessons in Year 1 and Year 2. Two near-identical public pages
   * is a duplicate-content signal, so the later year points at the earlier one.
   * Computed from the lesson list, so it corrects itself if the content diverges.
   */
  canonicalPath: string
  /**
   * Up to TRY_QUESTION_COUNT real published questions from this topic, answers
   * included, for the try-before-signup panel.
   *
   * Yes, this puts correct answers in public HTML. That is the deliberate trade:
   * until Sept 2026 a stranger could not see a single question without creating
   * an account, and 17 of 29 registered children never signed in even once. Five
   * questions out of a bank of 11,000 is a sample, and the topic pages are the
   * surface people already arrive on.
   */
  tryQuestions: PublicTryQuestion[]
}

/** One question offered on a public page. Hints are NOT included. */
export type PublicTryQuestion = {
  id: string
  question: string
  /** correct answer plus distractors, already shuffled, stable per build. */
  options: string[]
  answer: string
  explanation: string | null
}

/** How many questions a logged-out visitor may try per topic. */
export const TRY_QUESTION_COUNT = 5

function yearNumber(label: string): number {
  const m = label.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 99
}

function displayYear(label: string): string {
  return `Year ${yearNumber(label)}`
}

export async function getPublicCurriculumSummary(): Promise<PublicSubjectSummary[]> {
  const { topics } = await getSnapshot()
  const bySubject = new Map<string, PublicSubjectSummary & { years: Set<string> }>()
  for (const t of topics) {
    if (!t.subjectSlug) continue
    let s = bySubject.get(t.subjectSlug)
    if (!s) {
      s = {
        name: t.subjectName,
        slug: t.subjectSlug,
        colourToken: t.colourToken,
        topicCount: 0,
        yearCount: 0,
        years: new Set<string>(),
      }
      bySubject.set(t.subjectSlug, s)
    }
    s.topicCount += 1
    s.years.add(t.yearLabel)
  }
  return [...bySubject.values()]
    .map(({ years, ...rest }) => ({ ...rest, yearCount: years.size }))
    .filter((s) => s.topicCount > 0)
    .sort(
      (a, b) =>
        PUBLIC_SUBJECT_SLUGS.indexOf(a.slug as PublicSubjectSlug) -
        PUBLIC_SUBJECT_SLUGS.indexOf(b.slug as PublicSubjectSlug),
    )
}

/**
 * Human year span for a subject, derived from the years it actually has topics in.
 *
 * The subject pages used to hardcode "Year 1 to Year 11", which is true for Maths,
 * English and Science but wrong for History and Geography (Year 1 to Year 9). Read
 * it off the data so a page can never claim coverage the catalogue does not have.
 */
export function formatYearRange(years: PublicYearGroup[]): string {
  if (years.length === 0) return ''
  const first = years[0].displayLabel
  const last = years[years.length - 1].displayLabel
  return first === last ? first : `${first} to ${last}`
}

export async function getPublicSubjectDetail(
  slug: string,
): Promise<PublicSubjectDetail | null> {
  if (!PUBLIC_SUBJECT_SLUGS.includes(slug as PublicSubjectSlug)) return null
  const { topics } = await getSnapshot()

  const mine = topics.filter((t) => t.subjectSlug === slug)
  if (mine.length === 0) return null

  const byYear = new Map<string, { keyStage: string; topics: { title: string; order: number }[] }>()
  for (const t of mine) {
    const bucket = byYear.get(t.yearLabel) ?? { keyStage: t.keyStage, topics: [] }
    bucket.topics.push({ title: t.title, order: t.orderIndex })
    byYear.set(t.yearLabel, bucket)
  }

  const years: PublicYearGroup[] = [...byYear.entries()]
    .map(([label, { keyStage, topics: ts }]) => ({
      label,
      displayLabel: displayYear(label),
      keyStage,
      topics: ts.sort((a, b) => a.order - b.order).map((t) => t.title),
    }))
    .sort((a, b) => yearNumber(a.label) - yearNumber(b.label))

  return {
    name: mine[0].subjectName,
    slug: mine[0].subjectSlug,
    colourToken: mine[0].colourToken,
    topicCount: mine.length,
    years,
  }
}

// ── Year and topic pages ─────────────────────────────────────────────────────
// These exist because /curriculum/[subject] collapsed a whole subject into one
// page. A parent does not search "maths curriculum", they search "year 7 maths
// topics" or "year 4 fractions". Six pages could never match that, so the 329
// topics and 2,463 lesson titles already in the database were invisible.
//
// Everything below returns titles and structure only. Lesson bodies, questions,
// answers and hints stay behind auth, exactly as the note at the top of this
// file requires.
//
// All of it is served from ONE memoised snapshot rather than a query per page.
// The first attempt queried per page and the build died: 465 prerenders against
// a pooler capped at connection_limit=10 produced 1,497 "Can't reach database
// server" errors. Two queries per minute instead of two per page.

type TopicRow = {
  id: string
  title: string
  slug: string | null
  orderIndex: number
  subjectName: string
  subjectSlug: string
  colourToken: string
  yearLabel: string
  keyStage: string
  lessonCount: number
  /** Sorted lesson titles, used to spot topics duplicated across years. */
  lessonSignature: string
}

type Snapshot = {
  topics: TopicRow[]
  lessonsByTopic: Map<string, string[]>
  tryByTopic: Map<string, PublicTryQuestion[]>
}

// LaTeX is fine: the public panel renders question text through MathText, the
// same way the signed-in quiz does. Markdown tables are not, so a question
// carrying one is skipped rather than shown as a row of raw pipes.
const UNRENDERABLE_PUBLICLY = /\|/

// Deterministic shuffle. Math.random() would reorder the options on every
// prerender, so two builds of the same page would differ for no reason.
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    const j = Math.abs(h) % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const SNAPSHOT_TTL_MS = 60_000
let snapshotCache: { at: number; data: Promise<Snapshot> } | null = null

async function loadSnapshot(): Promise<Snapshot> {
  const [topics, units, questions] = await withDbRetry(() => Promise.all([
    prisma.topic.findMany({
      where: { is_published: true, subject: { slug: { in: [...PUBLIC_SUBJECT_SLUGS] } } },
      orderBy: { order_index: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        order_index: true,
        subject: { select: { name: true, slug: true, colour_token: true } },
        year_group: { select: { label: true, key_stage: true } },
      },
    }),
    prisma.curriculumUnit.findMany({
      orderBy: { order_index: 'asc' },
      select: { topic_id: true, title: true },
    }),
    // Only published questions ever leave this file, same rule as everywhere
    // else. 'sprout' is the gentlest tier, which is what a stranger should meet
    // first. Ordered by id so every build picks the same five.
    prisma.quizQuestion.findMany({
      where: { status: 'published', tier: 'sprout' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        topic_id: true,
        question_text: true,
        correct_answer: true,
        distractors: true,
        explanation: true,
      },
    }),
  ]))

  const lessonsByTopic = new Map<string, string[]>()
  for (const u of units) {
    if (!u.topic_id) continue
    const list = lessonsByTopic.get(u.topic_id)
    if (list) list.push(u.title)
    else lessonsByTopic.set(u.topic_id, [u.title])
  }

  const tryByTopic = new Map<string, PublicTryQuestion[]>()
  for (const q of questions) {
    if (!q.topic_id) continue
    const kept = tryByTopic.get(q.topic_id)
    if (kept && kept.length >= TRY_QUESTION_COUNT) continue
    if (UNRENDERABLE_PUBLICLY.test(q.question_text)) continue

    // A question with no distractors has nothing to choose between.
    const distractors = Array.isArray(q.distractors)
      ? (q.distractors as unknown[]).filter((d): d is string => typeof d === 'string' && d.length > 0)
      : []
    if (distractors.length < 2) continue
    if (distractors.some((d) => UNRENDERABLE_PUBLICLY.test(d))) continue
    if (UNRENDERABLE_PUBLICLY.test(q.correct_answer)) continue
    // A distractor equal to the answer would make the question unanswerable.
    if (distractors.includes(q.correct_answer)) continue

    const entry: PublicTryQuestion = {
      id: q.id,
      question: q.question_text,
      options: seededShuffle([q.correct_answer, ...distractors], q.id),
      answer: q.correct_answer,
      explanation: q.explanation ?? null,
    }
    if (kept) kept.push(entry)
    else tryByTopic.set(q.topic_id, [entry])
  }

  return {
    lessonsByTopic,
    tryByTopic,
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      orderIndex: t.order_index,
      subjectName: t.subject.name,
      subjectSlug: t.subject.slug as string,
      colourToken: t.subject.colour_token,
      yearLabel: t.year_group.label,
      keyStage: t.year_group.key_stage,
      lessonCount: lessonsByTopic.get(t.id)?.length ?? 0,
      lessonSignature: [...(lessonsByTopic.get(t.id) ?? [])].sort().join('||'),
    })),
  }
}

function getSnapshot(): Promise<Snapshot> {
  const now = Date.now()
  if (!snapshotCache || now - snapshotCache.at > SNAPSHOT_TTL_MS) {
    const pending = loadSnapshot()
    // Evict a rejected snapshot immediately. We cache the promise, not the value,
    // so without this one transient connection failure is handed to every caller
    // for the rest of the TTL and a single blip fails a whole batch of pages.
    pending.catch(() => {
      if (snapshotCache?.data === pending) snapshotCache = null
    })
    snapshotCache = { at: now, data: pending }
  }
  return snapshotCache.data
}

/** Every (subject, year) pair that has published topics. Drives generateStaticParams. */
export async function getPublicYearParams(): Promise<{ subject: string; year: string }[]> {
  const { topics } = await getSnapshot()
  const seen = new Set<string>()
  const out: { subject: string; year: string }[] = []
  for (const t of topics) {
    if (!t.subjectSlug) continue
    const key = `${t.subjectSlug}/${t.yearLabel}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ subject: t.subjectSlug, year: t.yearLabel })
  }
  return out
}

/** Every topic that clears PUBLIC_TOPIC_MIN_UNITS and therefore has its own page. */
export async function getPublicTopicParams(): Promise<
  { subject: string; year: string; topic: string }[]
> {
  const { topics } = await getSnapshot()
  return topics
    .filter((t) => t.subjectSlug && t.slug && t.lessonCount >= PUBLIC_TOPIC_MIN_UNITS)
    .map((t) => ({ subject: t.subjectSlug, year: t.yearLabel, topic: t.slug as string }))
}

export async function getPublicYearDetail(
  subjectSlug: string,
  yearLabel: string,
): Promise<PublicYearDetail | null> {
  if (!PUBLIC_SUBJECT_SLUGS.includes(subjectSlug as PublicSubjectSlug)) return null
  const { topics } = await getSnapshot()

  const inYear = topics
    .filter((t) => t.subjectSlug === subjectSlug && t.yearLabel === yearLabel)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  if (inYear.length === 0) return null

  const first = inYear[0]
  return {
    subjectName: first.subjectName,
    subjectSlug: first.subjectSlug,
    colourToken: first.colourToken,
    yearLabel,
    displayLabel: displayYear(yearLabel),
    keyStage: first.keyStage,
    lessonCount: inYear.reduce((n, t) => n + t.lessonCount, 0),
    topics: inYear.map((t) => ({
      title: t.title,
      slug: t.slug,
      lessonCount: t.lessonCount,
      hasPage: Boolean(t.slug) && t.lessonCount >= PUBLIC_TOPIC_MIN_UNITS,
    })),
  }
}

export async function getPublicTopicDetail(
  subjectSlug: string,
  yearLabel: string,
  topicSlug: string,
): Promise<PublicTopicDetail | null> {
  if (!PUBLIC_SUBJECT_SLUGS.includes(subjectSlug as PublicSubjectSlug)) return null
  const { topics, lessonsByTopic, tryByTopic } = await getSnapshot()

  const siblings = topics
    .filter((t) => t.subjectSlug === subjectSlug && t.yearLabel === yearLabel)
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const idx = siblings.findIndex((t) => t.slug === topicSlug)
  if (idx === -1) return null
  const topic = siblings[idx]
  // Same bar generateStaticParams uses, so a thin topic 404s rather than
  // rendering a page with nothing on it.
  if (topic.lessonCount < PUBLIC_TOPIC_MIN_UNITS) return null

  const link = (t: TopicRow | undefined) =>
    t && t.slug && t.lessonCount >= PUBLIC_TOPIC_MIN_UNITS ? { title: t.title, slug: t.slug } : null

  // Canonical: if an earlier year in the same subject and key stage teaches the
  // identical lesson list, that page is the original and this one defers to it.
  const selfPath = `/curriculum/${topic.subjectSlug}/${yearLabel}/${topicSlug}`
  let canonicalPath = selfPath
  if (topic.lessonSignature) {
    const twin = topics
      .filter(
        (t) =>
          t.subjectSlug === topic.subjectSlug &&
          t.keyStage === topic.keyStage &&
          t.slug &&
          t.lessonSignature === topic.lessonSignature &&
          t.lessonCount >= PUBLIC_TOPIC_MIN_UNITS,
      )
      .sort((a, b) => yearNumber(a.yearLabel) - yearNumber(b.yearLabel))[0]
    if (twin && twin.id !== topic.id) {
      canonicalPath = `/curriculum/${twin.subjectSlug}/${twin.yearLabel}/${twin.slug}`
    }
  }

  return {
    subjectName: topic.subjectName,
    subjectSlug: topic.subjectSlug,
    colourToken: topic.colourToken,
    yearLabel,
    displayLabel: displayYear(yearLabel),
    keyStage: topic.keyStage,
    title: topic.title,
    slug: topicSlug,
    lessons: lessonsByTopic.get(topic.id) ?? [],
    previousTopic: link(siblings[idx - 1]),
    nextTopic: link(siblings[idx + 1]),
    canonicalPath,
    tryQuestions: tryByTopic.get(topic.id) ?? [],
  }
}

// ── /try: the two-tap route to a real question ───────────────────────────────
// The five-question panel above lives on 293 topic pages, three levels down a
// browse tree built for search engines. A child on the homepage never reaches
// it. /try asks two things, year and subject, and then asks a question.
//
// Same snapshot, same published-only questions, same public-answer trade-off.

/** A topic needs at least this many usable questions before /try will offer it. */
export const TRY_MIN_QUESTIONS = 3

export type PublicTrySubject = { name: string; slug: string; colourToken: string }

export type PublicTryYear = {
  label: string
  displayLabel: string
  keyStage: string
  subjects: PublicTrySubject[]
}

export type PublicTrySet = {
  yearLabel: string
  displayLabel: string
  keyStage: string
  subjectName: string
  subjectSlug: string
  colourToken: string
  topicTitle: string
  /** The topic's own public page, when it has one. */
  topicPath: string | null
  questions: PublicTryQuestion[]
  /** How many other topics in this year and subject could have been offered. */
  otherTopics: number
}

function tryCandidates(snapshot: Snapshot): TopicRow[] {
  return snapshot.topics.filter(
    (t) => t.subjectSlug && (snapshot.tryByTopic.get(t.id)?.length ?? 0) >= TRY_MIN_QUESTIONS,
  )
}

/** Every year that has at least one subject with questions to try, in year order. */
export async function getPublicTryYears(): Promise<PublicTryYear[]> {
  const snapshot = await getSnapshot()
  const byYear = new Map<string, PublicTryYear>()
  for (const t of tryCandidates(snapshot)) {
    let y = byYear.get(t.yearLabel)
    if (!y) {
      y = { label: t.yearLabel, displayLabel: displayYear(t.yearLabel), keyStage: t.keyStage, subjects: [] }
      byYear.set(t.yearLabel, y)
    }
    if (!y.subjects.some((s) => s.slug === t.subjectSlug)) {
      y.subjects.push({ name: t.subjectName, slug: t.subjectSlug, colourToken: t.colourToken })
    }
  }
  return [...byYear.values()]
    .map((y) => ({
      ...y,
      subjects: y.subjects.sort(
        (a, b) =>
          PUBLIC_SUBJECT_SLUGS.indexOf(a.slug as PublicSubjectSlug) -
          PUBLIC_SUBJECT_SLUGS.indexOf(b.slug as PublicSubjectSlug),
      ),
    }))
    .sort((a, b) => yearNumber(a.label) - yearNumber(b.label))
}

export async function getPublicTryYear(yearLabel: string): Promise<PublicTryYear | null> {
  const years = await getPublicTryYears()
  return years.find((y) => y.label === yearLabel) ?? null
}

/**
 * The questions to offer for one year and subject. The topic rotates once a day
 * so a child who comes back tomorrow meets something new; within a day it is
 * stable, so the page can be prerendered and shared.
 */
export async function getPublicTrySet(
  yearLabel: string,
  subjectSlug: string,
): Promise<PublicTrySet | null> {
  if (!PUBLIC_SUBJECT_SLUGS.includes(subjectSlug as PublicSubjectSlug)) return null
  const snapshot = await getSnapshot()
  const candidates = tryCandidates(snapshot)
    .filter((t) => t.yearLabel === yearLabel && t.subjectSlug === subjectSlug)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  if (candidates.length === 0) return null

  const dayOfYear = Math.floor(Date.now() / 86_400_000)
  const topic = candidates[dayOfYear % candidates.length]
  const hasPage = Boolean(topic.slug) && topic.lessonCount >= PUBLIC_TOPIC_MIN_UNITS

  return {
    yearLabel,
    displayLabel: displayYear(yearLabel),
    keyStage: topic.keyStage,
    subjectName: topic.subjectName,
    subjectSlug: topic.subjectSlug,
    colourToken: topic.colourToken,
    topicTitle: topic.title,
    topicPath: hasPage ? `/curriculum/${topic.subjectSlug}/${yearLabel}/${topic.slug}` : null,
    questions: snapshot.tryByTopic.get(topic.id) ?? [],
    otherTopics: candidates.length - 1,
  }
}
