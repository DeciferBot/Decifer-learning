// /try/[year] — second of the two taps: pick a subject.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { getPublicTryYear, getPublicTryYears } from '@/lib/public-curriculum'
import { inkOn } from '@/lib/subject-colour'

export const revalidate = 86400

type Props = { params: { year: string } }

export async function generateStaticParams() {
  const years = await getPublicTryYears()
  return years.map((y) => ({ year: y.label }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const y = await getPublicTryYear(params.year)
  return {
    title: y ? `Try ${y.displayLabel} questions, free` : 'Try it free',
    robots: { index: false, follow: true },
  }
}

export default async function TryYearPage({ params }: Props) {
  const year = await getPublicTryYear(params.year)
  if (!year) notFound()

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Link
          href="/try"
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-muted hover:text-ink"
        >
          <span aria-hidden>←</span>&nbsp;Change year
        </Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-700">
          {year.displayLabel} · {year.keyStage}
        </p>
        <h1 className="mt-2 font-heading text-3xl font-black text-ink sm:text-4xl">
          Pick a subject.
        </h1>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {year.subjects.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/try/${year.label}/${s.slug}`}
                className="flex h-24 items-center justify-center rounded-lg border-2 border-black/8 font-heading text-xl font-bold shadow-clay-sm transition-[transform,box-shadow] duration-fast ease-out hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-clay-pressed touch-manipulation motion-reduce:transition-none"
                style={{ backgroundColor: s.colourToken, color: inkOn(s.colourToken) }}
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
