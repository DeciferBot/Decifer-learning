import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllGuides, getGuide } from '@/lib/guides'
import { GUIDE_CATEGORY_LABELS } from '@/lib/guides/types'
import { GuideRenderer } from '@/components/guides/GuideRenderer'
import { jsonLd } from '@/lib/json-ld'

const BASE = 'https://www.deciferlearning.com'

// Guides are repo-authored data with no DB dependency, so every page can be
// fully static at build time.
export const dynamic = 'force-static'

export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getGuide(params.slug)
  if (!guide) return {}
  const metaDescription = guide.metaDescription ?? guide.description
  return {
    // `absolute` opts out of the root layout's '%s | Decifer Learning'
    // template. These are informational guides that a parent finds by
    // searching for the topic, not the brand, and the suffix was spending 19
    // of the roughly 60 characters Google displays on a word that does not
    // help them decide whether to click.
    title: { absolute: guide.title },
    description: metaDescription,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: metaDescription,
      type: 'article',
      publishedTime: guide.datePublished,
      modifiedTime: guide.dateModified,
    },
  }
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug)
  if (!guide) notFound()

  const related = guide.related
    .map((slug) => getGuide(slug))
    .filter((g): g is NonNullable<typeof g> => Boolean(g))

  const graph: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.h1,
      description: guide.description,
      abstract: guide.keyAnswer,
      // Google lists no required Article properties, but image, author and both
      // dates are recommended and help it show a better title, image and date.
      image: [`${BASE}/guides/${guide.slug}/opengraph-image`],
      datePublished: guide.datePublished,
      dateModified: guide.dateModified,
      mainEntityOfPage: `${BASE}/guides/${guide.slug}`,
      inLanguage: 'en-GB',
      isAccessibleForFree: true,
      author: { '@type': 'Organization', name: 'Decifer Learning', url: BASE },
      publisher: {
        '@type': 'Organization',
        name: 'Decifer Learning',
        url: BASE,
        logo: {
          '@type': 'ImageObject',
          url: `${BASE}/brand/decifer-app-icon.svg`,
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'UAE parent guides', item: `${BASE}/guides` },
        { '@type': 'ListItem', position: 3, name: guide.h1, item: `${BASE}/guides/${guide.slug}` },
      ],
    },
  ]
  // No FAQPage markup here on purpose. Google stopped showing FAQ rich results
  // entirely on 7 May 2026 and deleted the documentation the following month,
  // so the markup earns nothing. The on-page Q&A stays because readers use it.

  const modified = new Date(guide.dateModified)

  return (
    <>
      {graph.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(node) }}
        />
      ))}

      <div className="space-y-6">
        <div>
          <Link
            href="/guides"
            className="mb-4 inline-block text-sm font-semibold text-brand hover:underline"
          >
            ← All UAE parent guides
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {GUIDE_CATEGORY_LABELS[guide.category]}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold leading-tight text-ink">
            {guide.h1}
          </h1>
          <p className="mt-3 leading-relaxed text-muted">{guide.description}</p>
          <p className="mt-3 text-xs text-muted">
            Updated{' '}
            {modified.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <GuideRenderer guide={guide} />

        {related.length > 0 ? (
          <section>
            <h2 className="font-heading text-xl font-bold text-ink">Keep reading</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/guides/${r.slug}`}
                  className="rounded-xl border border-black/5 bg-surface p-4 shadow-sm transition hover:border-brand/30"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {GUIDE_CATEGORY_LABELS[r.category]}
                  </p>
                  <p className="mt-1 font-semibold text-ink">{r.h1}</p>
                  <p className="mt-1 text-sm text-muted">{r.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
