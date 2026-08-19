// /curriculum/[subject]/[year] — e.g. /curriculum/maths/year-7
//
// The layer the site was missing. /curriculum/[subject] answered "maths
// curriculum", which nobody searches. Parents search "year 7 maths topics" and
// "what does my child learn in year 4 science". One page per (subject, year)
// matches that, and there are 51 of them straight out of the catalogue.
//
// Titles and structure only. Lesson bodies and questions stay behind auth.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicYearDetail, getPublicYearParams } from '@/lib/public-curriculum'
import { jsonLd } from '@/lib/json-ld'
import { MarketingNav } from '@/components/marketing/MarketingNav'

export const revalidate = 86400

const BASE = 'https://www.deciferlearning.com'

type Props = { params: { subject: string; year: string } }

export async function generateStaticParams() {
  return getPublicYearParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getPublicYearDetail(params.subject, params.year)
  if (!detail) return { title: 'Curriculum' }

  const { displayLabel, subjectName, keyStage, topics } = detail
  return {
    // Keep it short: the root layout appends "| Decifer Learning", and Google
    // truncates around 60 characters. Lead with the words a parent types.
    title: `${displayLabel} ${subjectName} Topics (${keyStage})`,
    description:
      `Every ${displayLabel} ${subjectName} topic in the UK National Curriculum: ` +
      `${topics.length} topics and ${detail.lessonCount} lessons, listed in teaching order. ` +
      `See exactly what your child covers in ${displayLabel} ${subjectName}.`,
    alternates: { canonical: `/curriculum/${detail.subjectSlug}/${detail.yearLabel}` },
  }
}

export default async function YearCurriculumPage({ params }: Props) {
  const detail = await getPublicYearDetail(params.subject, params.year)
  if (!detail) notFound()

  const url = `${BASE}/curriculum/${detail.subjectSlug}/${detail.yearLabel}`

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Curriculum', item: `${BASE}/curriculum` },
      {
        '@type': 'ListItem',
        position: 3,
        name: detail.subjectName,
        item: `${BASE}/curriculum/${detail.subjectSlug}`,
      },
      { '@type': 'ListItem', position: 4, name: detail.displayLabel, item: url },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${detail.displayLabel} ${detail.subjectName} topics`,
    numberOfItems: detail.topics.length,
    itemListElement: detail.topics.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.title,
      ...(t.hasPage ? { url: `${url}/${t.slug}` } : {}),
    })),
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
          <Link href={`/curriculum/${detail.subjectSlug}`} className="hover:text-ink">
            {detail.subjectName}
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-ink">{detail.displayLabel}</span>
        </nav>

        <header>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: detail.colourToken }}
          >
            {detail.subjectName} · {detail.keyStage}
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold text-ink">
            {detail.displayLabel} {detail.subjectName} topics
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            {detail.topics.length} topics and {detail.lessonCount} lessons, in the order they are
            taught. This is the full {detail.displayLabel} {detail.subjectName} curriculum, mapped
            to the UK National Curriculum and quality-checked before any child sees it.
          </p>
        </header>

        <ol className="mt-12 space-y-3">
          {detail.topics.map((topic, i) => (
            <li
              key={topic.title}
              className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-xs font-bold text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {topic.hasPage ? (
                    <Link
                      href={`/curriculum/${detail.subjectSlug}/${detail.yearLabel}/${topic.slug}`}
                      className="font-heading font-semibold text-ink underline underline-offset-4 hover:no-underline"
                    >
                      {topic.title}
                    </Link>
                  ) : (
                    <span className="font-heading font-semibold text-ink">{topic.title}</span>
                  )}
                  {topic.lessonCount > 0 && (
                    <p className="mt-1 text-sm text-muted">
                      {topic.lessonCount} {topic.lessonCount === 1 ? 'lesson' : 'lessons'}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-2xl border border-maths/20 bg-maths/5 p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-ink">
            Start {detail.displayLabel} {detail.subjectName}
          </h2>
          <p className="mt-2 text-muted">
            Every subject and year group, free while we are in beta. No card required.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex h-12 items-center rounded-xl bg-maths px-8 font-semibold text-white"
          >
            Create a free account
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          <Link href={`/curriculum/${detail.subjectSlug}`} className="hover:text-ink">
            See every {detail.subjectName} year group
          </Link>
        </p>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd) }} />
    </div>
  )
}
