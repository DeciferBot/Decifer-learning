// Public, SEO-facing curriculum data.
//
// Powers the indexable /curriculum pages. Unlike the child-facing learn store,
// these reads are NOT year-group scoped (a crawler/visitor has no profile) and
// expose ONLY published topic *titles* grouped by year — never questions,
// answers, hints, or lesson bodies. Gated content stays behind auth.
//
// Limited to the three marketed core subjects that carry a URL slug
// (Maths, English, Science). Other published subjects (History, Geography)
// have no subject slug and are not part of the public marketing surface.

import { prisma } from '@/lib/prisma'

export const PUBLIC_SUBJECT_SLUGS = ['maths', 'english', 'science'] as const
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

function yearNumber(label: string): number {
  const m = label.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 99
}

function displayYear(label: string): string {
  return `Year ${yearNumber(label)}`
}

export async function getPublicCurriculumSummary(): Promise<PublicSubjectSummary[]> {
  const subjects = await prisma.subject.findMany({
    where: { slug: { in: [...PUBLIC_SUBJECT_SLUGS] } },
    select: {
      name: true,
      slug: true,
      colour_token: true,
      topics: {
        where: { is_published: true },
        select: { year_group_id: true },
      },
    },
  })

  return subjects
    .map((s) => ({
      name: s.name,
      slug: s.slug as string,
      colourToken: s.colour_token,
      topicCount: s.topics.length,
      yearCount: new Set(s.topics.map((t) => t.year_group_id)).size,
    }))
    .filter((s) => s.topicCount > 0)
    .sort(
      (a, b) =>
        PUBLIC_SUBJECT_SLUGS.indexOf(a.slug as PublicSubjectSlug) -
        PUBLIC_SUBJECT_SLUGS.indexOf(b.slug as PublicSubjectSlug),
    )
}

export async function getPublicSubjectDetail(
  slug: string,
): Promise<PublicSubjectDetail | null> {
  if (!PUBLIC_SUBJECT_SLUGS.includes(slug as PublicSubjectSlug)) return null

  const subject = await prisma.subject.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      colour_token: true,
      topics: {
        where: { is_published: true },
        select: {
          title: true,
          order_index: true,
          year_group: { select: { label: true, key_stage: true } },
        },
      },
    },
  })

  if (!subject || !subject.slug || subject.topics.length === 0) return null

  const byYear = new Map<string, { keyStage: string; topics: { title: string; order: number }[] }>()
  for (const t of subject.topics) {
    const label = t.year_group.label
    const bucket = byYear.get(label) ?? { keyStage: t.year_group.key_stage, topics: [] }
    bucket.topics.push({ title: t.title, order: t.order_index })
    byYear.set(label, bucket)
  }

  const years: PublicYearGroup[] = [...byYear.entries()]
    .map(([label, { keyStage, topics }]) => ({
      label,
      displayLabel: displayYear(label),
      keyStage,
      topics: topics.sort((a, b) => a.order - b.order).map((t) => t.title),
    }))
    .sort((a, b) => yearNumber(a.label) - yearNumber(b.label))

  return {
    name: subject.name,
    slug: subject.slug,
    colourToken: subject.colour_token,
    topicCount: subject.topics.length,
    years,
  }
}
