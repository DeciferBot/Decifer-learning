import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicCurriculumSummary } from '@/lib/public-curriculum'
import { jsonLd } from '@/lib/json-ld'
import { MarketingNav } from '@/components/marketing/MarketingNav'

export const revalidate = 86400 // rebuild at most once a day — content changes slowly

export const metadata: Metadata = {
  // Was "Curriculum | every topic we cover". Now names the curriculum and the
  // span, so it can match "uk national curriculum topics by year".
  title: 'UK National Curriculum Topic List, Year 1 to Year 11',
  description:
    'Browse the full Decifer Learning curriculum, mapped to the UK National Curriculum: Maths, English and Science from Year 1 to Year 11 (KS1–KS4/GCSE), plus History and Geography from Year 1 to Year 9.',
  alternates: { canonical: '/curriculum' },
}

const BASE = 'https://www.deciferlearning.com'

export default async function CurriculumIndexPage() {
  const subjects = await getPublicCurriculumSummary()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Decifer Learning curriculum',
    description: 'Maths, English, Science, History and Geography topics across the UK National Curriculum.',
    itemListElement: subjects.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.name,
      url: `${BASE}/curriculum/${s.slug}`,
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Curriculum', item: `${BASE}/curriculum` },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <main className="mx-auto max-w-4xl px-4 py-16">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-ink">Curriculum</span>
        </nav>

        <header>
          <h1 className="font-heading text-4xl font-bold text-ink">UK National Curriculum topics, Year 1 to Year 11</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Every topic in Decifer Learning is mapped to the UK National Curriculum. Browse what we
            cover, by subject and year group, from Year 1 through to Year 11.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {subjects.map((s) => (
            <Link
              key={s.slug}
              href={`/curriculum/${s.slug}`}
              className="group rounded-2xl border border-black/5 bg-surface p-6 shadow-sm transition-opacity hover:opacity-90"
            >
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: s.colourToken }}
              >
                {s.name}
              </span>
              <p className="mt-4 font-heading text-2xl font-bold text-ink">{s.topicCount} topics</p>
              <p className="mt-1 text-sm text-muted">
                Across {s.yearCount} year {s.yearCount === 1 ? 'group' : 'groups'}
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-maths group-hover:underline">
                Browse {s.name} →
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-maths/20 bg-maths/5 p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-ink">Ready to start?</h2>
          <p className="mt-2 text-muted">Every subject and year group, free while we are in beta. No card required.</p>
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
        dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />
    </div>
  )
}
