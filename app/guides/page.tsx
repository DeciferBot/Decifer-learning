import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllGuides } from '@/lib/guides'
import { GUIDE_CATEGORY_LABELS, type GuideCategory } from '@/lib/guides/types'
import { jsonLd } from '@/lib/json-ld'

const BASE = 'https://www.deciferlearning.com'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  // `absolute` for the same reason as the individual guides: parents find
  // these by searching the topic, and '| Decifer Learning' was pushing the
  // useful half of the title past what Google displays.
  title: { absolute: 'UAE School Guides for Parents: Fees, Ratings, Term Dates' },
  description:
    'Practical guides for parents in Dubai, Abu Dhabi and the wider UAE: school fees, inspection ratings, term dates, year group ages, GCSEs and the British curriculum.',
  alternates: { canonical: '/guides' },
}

// Category order on the hub page: schools first (highest search demand),
// curriculum second, planning third.
const CATEGORY_ORDER: GuideCategory[] = [
  'schools-and-fees',
  'curriculum-explained',
  'planning-and-dates',
]

export default function GuidesIndexPage() {
  const guides = getAllGuides()

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'UAE school guides for parents',
    url: `${BASE}/guides`,
    hasPart: guides.map((g) => ({
      '@type': 'Article',
      headline: g.h1,
      url: `${BASE}/guides/${g.slug}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(collectionLd) }}
      />

      <div className="space-y-10">
        <div>
          <h1 className="font-heading text-3xl font-bold leading-tight text-ink">
            UAE school guides for parents
          </h1>
          <p className="mt-3 leading-relaxed text-muted">
            Choosing a school, understanding fees and inspection ratings, planning around term
            dates, and making sense of the British curriculum. Written for families in Dubai, Abu
            Dhabi and across the UAE, using public sources you can check yourself.
          </p>
          <p className="mt-3 rounded-xl border border-brand/20 bg-brand-50 px-4 py-3 text-sm text-muted">
            Decifer Learning is a UK curriculum practice app for Years 1 to 11, and it is
            completely free while in beta.{' '}
            <Link href="/register" className="font-semibold text-brand-700 hover:underline">
              Create a free account
            </Link>
            .
          </p>
        </div>

        {CATEGORY_ORDER.map((category) => {
          const inCategory = guides.filter((g) => g.category === category)
          if (inCategory.length === 0) return null
          return (
            <section key={category}>
              <h2 className="font-heading text-xl font-bold text-ink">
                {GUIDE_CATEGORY_LABELS[category]}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {inCategory.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/guides/${g.slug}`}
                    className="flex min-h-[48px] flex-col rounded-xl border border-black/5 bg-surface p-4 shadow-sm transition hover:border-brand/30"
                  >
                    <p className="font-semibold leading-snug text-ink">{g.h1}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{g.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
