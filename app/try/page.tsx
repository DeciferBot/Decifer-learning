// /try — the shortest route from the homepage to a real question.
//
// Before this the only way to answer anything without an account was to find a
// topic page three levels down /curriculum. Now: pick a year, pick a subject,
// answer five questions. Nothing is saved and no account is asked for until
// the child has something worth keeping.
//
// Not indexed: the topic pages carry the search traffic; this is the funnel.

import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { getPublicTryYears } from '@/lib/public-curriculum'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Try five real questions, free',
  description:
    'Pick your school year and a subject, then answer five real UK curriculum questions. No account, nothing saved.',
  robots: { index: false, follow: true },
}

export default async function TryPage() {
  const years = await getPublicTryYears()

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Try it free</p>
        <h1 className="mt-2 font-heading text-3xl font-black text-ink sm:text-4xl">
          Which year are you in?
        </h1>
        <p className="mt-2 text-muted">
          Five real questions. No account, nothing saved.
        </p>

        <ul className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {years.map((y) => (
            <li key={y.label}>
              <Link
                href={`/try/${y.label}`}
                className="flex h-16 flex-col items-center justify-center rounded-lg border-2 border-black/8 bg-surface font-heading text-lg font-bold text-ink shadow-clay-sm transition-[transform,box-shadow] duration-fast ease-out hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-clay-pressed touch-manipulation motion-reduce:transition-none"
              >
                {y.displayLabel}
                <span className="text-xs font-normal text-muted">{y.keyStage}</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-muted">
          Setting up for your child?{' '}
          <Link href="/register" className="font-semibold text-brand-700 underline">
            Create a parent account
          </Link>
          {' · '}
          <Link href="/login" className="font-semibold text-brand-700 underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  )
}
