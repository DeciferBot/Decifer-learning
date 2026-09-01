// /curriculum/[subject]/[year]/[topic] — e.g. /curriculum/maths/year-7/algebra-basics
//
// The long tail. A parent searching "year 4 fractions" or "year 7 algebra
// topics" is looking for one topic, not a subject overview. 293 of the 329
// published topics carry enough lessons to justify a page.
//
// Only topics with at least PUBLIC_TOPIC_MIN_UNITS lessons get one. Below that
// there is nothing to put on the page but the title, and a wall of near-empty
// pages costs more in quality signal than it earns in coverage.
//
// Lesson TITLES only, plus a five-question try panel. Lesson bodies and hints
// stay behind auth; the five questions and their answers are deliberately public
// (see PublicTopicDetail.tryQuestions for why).

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicTopicDetail, getPublicTopicParams } from '@/lib/public-curriculum'
import { jsonLd } from '@/lib/json-ld'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { TryQuestions } from '@/components/marketing/TryQuestions'
import { inkOn } from '@/lib/subject-colour'

export const revalidate = 86400

const BASE = 'https://www.deciferlearning.com'

type Props = { params: { subject: string; year: string; topic: string } }

export async function generateStaticParams() {
  return getPublicTopicParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getPublicTopicDetail(params.subject, params.year, params.topic)
  if (!d) return { title: 'Curriculum' }

  return {
    // Short enough to survive truncation once the layout appends the brand.
    title: `${d.title} | ${d.displayLabel} ${d.subjectName}`,
    description:
      `${d.title} for ${d.displayLabel} ${d.subjectName} (${d.keyStage}): ` +
      `${d.lessons.length} lessons in teaching order. Part of the UK National Curriculum, ` +
      `quality-checked before any child sees it.`,
    // May point at an earlier year when the lesson list is identical; see
    // canonicalPath in lib/public-curriculum.ts.
    alternates: { canonical: d.canonicalPath },
  }
}

export default async function TopicCurriculumPage({ params }: Props) {
  const d = await getPublicTopicDetail(params.subject, params.year, params.topic)
  if (!d) notFound()

  const yearUrl = `${BASE}/curriculum/${d.subjectSlug}/${d.yearLabel}`
  const url = `${yearUrl}/${d.slug}`

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Curriculum', item: `${BASE}/curriculum` },
      {
        '@type': 'ListItem',
        position: 3,
        name: d.subjectName,
        item: `${BASE}/curriculum/${d.subjectSlug}`,
      },
      { '@type': 'ListItem', position: 4, name: d.displayLabel, item: yearUrl },
      { '@type': 'ListItem', position: 5, name: d.title, item: url },
    ],
  }

  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `${d.title} — ${d.displayLabel} ${d.subjectName}`,
    description: `${d.lessons.length} lessons covering ${d.title} in the ${d.displayLabel} ${d.subjectName} curriculum.`,
    url,
    provider: { '@type': 'EducationalOrganization', name: 'Decifer Learning', url: BASE },
    educationalLevel: d.keyStage,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: `PT${d.lessons.length}H`,
    },
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <main className="mx-auto max-w-4xl px-4 py-16">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/curriculum" className="hover:text-ink">Curriculum</Link>
          <span aria-hidden>/</span>
          <Link href={`/curriculum/${d.subjectSlug}`} className="hover:text-ink">{d.subjectName}</Link>
          <span aria-hidden>/</span>
          <Link href={`/curriculum/${d.subjectSlug}/${d.yearLabel}`} className="hover:text-ink">
            {d.displayLabel}
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-ink">{d.title}</span>
        </nav>

        <header>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold "
            style={{ backgroundColor: d.colourToken, color: inkOn(d.colourToken) }}
          >
            {d.displayLabel} {d.subjectName} · {d.keyStage}
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold text-ink">{d.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            {d.lessons.length} lessons, in the order they are taught. Part of the{' '}
            {d.displayLabel} {d.subjectName} curriculum.
          </p>
        </header>

        <section className="mt-12">
          <h2 className="font-heading text-xl font-bold text-ink">What this topic covers</h2>
          <ol className="mt-4 space-y-2">
            {d.lessons.map((lesson, i) => (
              <li
                key={`${i}-${lesson}`}
                className="flex items-start gap-3 rounded-xl border border-black/5 bg-surface p-4 text-sm leading-relaxed text-ink shadow-sm"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-xs font-bold text-muted">
                  {i + 1}
                </span>
                <span>{lesson}</span>
              </li>
            ))}
          </ol>
        </section>

        {d.tryQuestions.length > 0 && (
          <TryQuestions
            questions={d.tryQuestions}
            topicTitle={d.title}
            yearLabel={d.displayLabel}
            subjectName={d.subjectName}
          />
        )}

        {(d.previousTopic || d.nextTopic) && (
          <nav className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-between" aria-label="Topic navigation">
            {d.previousTopic ? (
              <Link
                href={`/curriculum/${d.subjectSlug}/${d.yearLabel}/${d.previousTopic.slug}`}
                className="flex min-h-[48px] items-center rounded-xl border border-black/10 bg-surface px-4 text-sm font-semibold text-ink hover:bg-black/5"
              >
                <span aria-hidden className="mr-2">←</span>
                {d.previousTopic.title}
              </Link>
            ) : (
              <span />
            )}
            {d.nextTopic && (
              <Link
                href={`/curriculum/${d.subjectSlug}/${d.yearLabel}/${d.nextTopic.slug}`}
                className="flex min-h-[48px] items-center rounded-xl border border-black/10 bg-surface px-4 text-sm font-semibold text-ink hover:bg-black/5 sm:text-right"
              >
                {d.nextTopic.title}
                <span aria-hidden className="ml-2">→</span>
              </Link>
            )}
          </nav>
        )}

        <div className="mt-12 rounded-2xl border border-brand/20 bg-brand/5 p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-ink">Learn {d.title}</h2>
          <p className="mt-2 text-muted">
            Every subject and year group, free while we are in beta. No card required.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex h-12 items-center rounded-xl bg-brand-600 transition-colors hover:bg-brand-700 px-8 font-semibold text-white"
          >
            Create a free account
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          <Link href={`/curriculum/${d.subjectSlug}/${d.yearLabel}`} className="hover:text-ink">
            All {d.displayLabel} {d.subjectName} topics
          </Link>
        </p>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(courseJsonLd) }} />
    </div>
  )
}
