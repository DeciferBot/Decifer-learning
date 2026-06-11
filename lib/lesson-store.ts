/**
 * Lesson Store — child-safe data access layer.
 *
 * All exported functions enforce the two child-facing safety rules:
 *   status = 'published'
 *   verification_status = 'verified'
 *
 * No AI generation, no seed imports, no verification scripts.
 */

import { prisma } from './prisma'

// ── Safety gate applied to every child-facing lesson query ───────────────────
const PUBLISHED_VERIFIED = {
  status: 'published' as const,
  verification_status: 'verified',
} satisfies { status: 'published'; verification_status: string }

// Children only ever see lessons for their own year group. `lessons.year_group`
// holds the same labels as `year_groups.label` ('year-3', 'year-7', …), so the
// caller passes the child's profile year-group label straight through.
function publishedVerifiedFor(yearGroup: string) {
  return { ...PUBLISHED_VERIFIED, year_group: yearGroup }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubjectCard = {
  id: string
  name: string
  slug: string
  colour_token: string
  lessonCount: number
}

export type TopicCard = {
  id: string
  title: string
  slug: string
  lessonCount: number
}

export type LessonCard = {
  id: string
  title: string
  slug: string
  difficulty_lane: string | null
  lesson_type: string | null
  estimated_minutes: number | null
  learning_objective: string | null
}

export type LessonDetail = LessonCard & {
  lesson_summary: string | null
  key_stage: string
  year_group: string
  app_experience: string | null
  topic_id: string
  source_reference: string | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns subjects that have at least one published+verified lesson
 * in the child's year group. Safe for child-facing subject-browse page.
 */
export async function getPublishedSubjects(yearGroup: string): Promise<SubjectCard[]> {
  const gate = publishedVerifiedFor(yearGroup)
  const rows = await prisma.subject.findMany({
    where: {
      slug: { not: null },
      lessons: { some: gate },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      colour_token: true,
      _count: { select: { lessons: { where: gate } } },
    },
    orderBy: { name: 'asc' },
  })

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug!,
    colour_token: s.colour_token,
    lessonCount: s._count.lessons,
  }))
}

/**
 * Returns topics under a subject that have at least one published+verified lesson
 * in the child's year group. Returns null for subject if the slug is unknown.
 */
export async function getPublishedTopicsForSubject(
  subjectSlug: string,
  yearGroup: string,
): Promise<{
  subject: Pick<SubjectCard, 'id' | 'name' | 'slug' | 'colour_token'> | null
  topics: TopicCard[]
}> {
  const subject = await prisma.subject.findFirst({
    where: { slug: subjectSlug },
    select: { id: true, name: true, slug: true, colour_token: true },
  })
  if (!subject || !subject.slug) return { subject: null, topics: [] }

  const gate = publishedVerifiedFor(yearGroup)
  const topics = await prisma.topic.findMany({
    where: {
      subject_id: subject.id,
      is_published: true,
      slug: { not: null },
      lessons: { some: gate },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      _count: { select: { lessons: { where: gate } } },
    },
    orderBy: { order_index: 'asc' },
  })

  return {
    subject: { ...subject, slug: subject.slug },
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug!,
      lessonCount: t._count.lessons,
    })),
  }
}

/**
 * Returns published+verified lessons in the child's year group for a topic
 * identified by subject+topic slugs.
 * Returns null for topic if the combination is unknown or unpublished.
 */
export async function getPublishedLessonsForTopic(
  subjectSlug: string,
  topicSlug: string,
  yearGroup: string,
): Promise<{
  subject: Pick<SubjectCard, 'name' | 'slug' | 'colour_token'> | null
  topic: Pick<TopicCard, 'id' | 'title' | 'slug'> | null
  lessons: LessonCard[]
}> {
  const subject = await prisma.subject.findFirst({
    where: { slug: subjectSlug },
    select: { id: true, name: true, slug: true, colour_token: true },
  })
  if (!subject || !subject.slug) return { subject: null, topic: null, lessons: [] }

  const topic = await prisma.topic.findFirst({
    where: { subject_id: subject.id, slug: topicSlug, is_published: true },
    select: { id: true, title: true, slug: true },
  })
  if (!topic || !topic.slug) {
    return {
      subject: { name: subject.name, slug: subject.slug, colour_token: subject.colour_token },
      topic: null,
      lessons: [],
    }
  }

  const lessons = await prisma.lesson.findMany({
    where: { topic_id: topic.id, ...publishedVerifiedFor(yearGroup) },
    select: {
      id: true,
      title: true,
      slug: true,
      difficulty_lane: true,
      lesson_type: true,
      estimated_minutes: true,
      learning_objective: true,
    },
    orderBy: [{ difficulty_lane: 'asc' }, { title: 'asc' }],
  })

  return {
    subject: { name: subject.name, slug: subject.slug, colour_token: subject.colour_token },
    topic: { id: topic.id, title: topic.title, slug: topic.slug },
    lessons,
  }
}

/**
 * Returns a single published+verified lesson by global slug, restricted to the
 * child's year group so a direct URL cannot surface another year's lesson.
 * Returns null for any lesson that is not published AND verified.
 * Never falls back to AI generation or seed content.
 */
export async function getPublishedLesson(
  lessonSlug: string,
  yearGroup: string,
): Promise<LessonDetail | null> {
  const lesson = await prisma.lesson.findFirst({
    where: { slug: lessonSlug, ...publishedVerifiedFor(yearGroup) },
    select: {
      id: true,
      title: true,
      slug: true,
      lesson_summary: true,
      learning_objective: true,
      key_stage: true,
      year_group: true,
      difficulty_lane: true,
      lesson_type: true,
      estimated_minutes: true,
      app_experience: true,
      topic_id: true,
      source_reference: true,
    },
  })
  return lesson
}

/**
 * Checks whether a lesson slug exists at all (regardless of status).
 * Used by the not-ready page to distinguish "never heard of it" from "exists but unpublished".
 * Does NOT return content — safe to call from child-facing routes.
 */
export async function lessonSlugExists(lessonSlug: string): Promise<boolean> {
  const count = await prisma.lesson.count({ where: { slug: lessonSlug } })
  return count > 0
}
