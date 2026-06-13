import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import {
  PUBLIC_SUBJECT_SLUGS,
  getPublicSubjectDetail,
} from '@/lib/public-curriculum'
import { jsonLd } from '@/lib/json-ld'

export const revalidate = 86400

const BASE = 'https://www.deciferlearning.com'

type Props = { params: { subject: string } }

export function generateStaticParams() {
  return PUBLIC_SUBJECT_SLUGS.map((subject) => ({ subject }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getPublicSubjectDetail(params.subject)
  if (!detail) return { title: 'Curriculum' }

  const keyStages = [...new Set(detail.years.map((y) => y.keyStage))].join(', ')
  return {
    title: `${detail.name} curriculum — Year 1 to Year 11`,
    description: `Every ${detail.name} topic in DECIFER Learning: ${detail.topicCount} topics across the UK National Curriculum (${keyStages}). Quality-checked and mapped year by year.`,
    alternates: { canonical: `/curriculum/${detail.slug}` },
  }
}

export default async function SubjectCurriculumPage({ params }: Props) {
  const detail = await getPublicSubjectDetail(params.subject)
  if (!detail) notFound()

  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `${detail.name} — UK National Curriculum`,
    description: `Quality-checked ${detail.name} covering ${detail.topicCount} topics from Year 1 to Year 11.`,
    url: `${BASE}/curriculum/${detail.slug}`,
    provider: { '@type': 'EducationalOrganization', name: 'DECIFER Learning', url: BASE },
    educationalLevel: [...new Set(detail.years.map((y) => y.keyStage))],
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Curriculum', item: `${BASE}/curriculum` },
      {
        '@type': 'ListItem',
        position: 3,
        name: detail.name,
        item: `${BASE}/curriculum/${detail.slug}`,
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <DeciferLogo size="sm" product="Learning" />
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm font-semibold text-maths hover:underline">
              Pricing
            </Link>
            <Link
              href="/register"
              className="flex h-9 items-center rounded-lg bg-maths px-4 text-sm font-semibold text-white"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/curriculum" className="hover:text-ink">Curriculum</Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-ink">{detail.name}</span>
        </nav>

        <header>
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: detail.colourToken }}
          >
            {detail.name}
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold text-ink">
            {detail.name} curriculum
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            {detail.topicCount} quality-checked {detail.name} topics, mapped to the UK National
            Curriculum from Year 1 to Year 11. Here is everything your child can learn.
          </p>
        </header>

        <div className="mt-12 space-y-8">
          {detail.years.map((year) => (
            <section
              key={year.label}
              className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm"
            >
              <div className="flex items-baseline gap-3">
                <h2 className="font-heading text-xl font-bold text-ink">{year.displayLabel}</h2>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                  {year.keyStage}
                </span>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {year.topics.map((title) => (
                  <li
                    key={title}
                    className="flex items-start gap-2 text-sm leading-relaxed text-ink"
                  >
                    <span aria-hidden className="mt-1 text-muted">•</span>
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-maths/20 bg-maths/5 p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-ink">
            Start learning {detail.name}
          </h2>
          <p className="mt-2 text-muted">
            Free for the first 3 Maths topics. Upgrade for unlimited Maths, English and Science.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex h-12 items-center rounded-xl bg-maths px-8 font-semibold text-white"
          >
            Create a free account
          </Link>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(courseJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />
    </div>
  )
}
