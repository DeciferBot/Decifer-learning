import type { Metadata } from 'next'
import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { getPublicCurriculumSummary } from '@/lib/public-curriculum'
import { jsonLd } from '@/lib/json-ld'

export const revalidate = 86400 // rebuild at most once a day — content changes slowly

export const metadata: Metadata = {
  title: 'Curriculum — every topic we cover',
  description:
    'Browse the full DECIFER Learning curriculum: every Maths, English, and Science topic across the UK National Curriculum, from Year 1 to Year 11 (KS1–KS4).',
  alternates: { canonical: '/curriculum' },
}

const BASE = 'https://www.deciferlearning.com'

export default async function CurriculumIndexPage() {
  const subjects = await getPublicCurriculumSummary()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'DECIFER Learning curriculum',
    description: 'Maths, English and Science topics across the UK National Curriculum.',
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
          <span className="font-medium text-ink">Curriculum</span>
        </nav>

        <header>
          <h1 className="font-heading text-4xl font-bold text-ink">Our curriculum</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Every topic in DECIFER Learning is mapped to the UK National Curriculum. Browse what we
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
          <p className="mt-2 text-muted">Free for the first 3 Maths topics. No card required.</p>
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
