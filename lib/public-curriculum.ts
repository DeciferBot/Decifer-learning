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
}

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
}

const SNAPSHOT_TTL_MS = 60_000
let snapshotCache: { at: number; data: Promise<Snapshot> } | null = null

async function loadSnapshot(): Promise<Snapshot> {
  const [topics, units] = await withDbRetry(() => Promise.all([
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
  ]))

  const lessonsByTopic = new Map<string, string[]>()
  for (const u of units) {
    if (!u.topic_id) continue
    const list = lessonsByTopic.get(u.topic_id)
    if (list) list.push(u.title)
    else lessonsByTopic.set(u.topic_id, [u.title])
  }

  return {
    lessonsByTopic,
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
  const { topics, lessonsByTopic } = await getSnapshot()

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
  }
}
