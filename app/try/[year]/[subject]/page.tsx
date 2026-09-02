// /try/[year]/[subject] — the question. Two taps from the homepage.
//
// The topic rotates daily (see getPublicTrySet). The five questions and their
// answers are public by design; the reasoning is on PublicTopicDetail.tryQuestions.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { TryQuestions } from '@/components/marketing/TryQuestions'
import { getPublicTrySet, getPublicTryYears } from '@/lib/public-curriculum'
import { inkOn } from '@/lib/subject-colour'

export const revalidate = 86400

type Props = { params: { year: string; subject: string } }

export async function generateStaticParams() {
  const years = await getPublicTryYears()
  return years.flatMap((y) => y.subjects.map((s) => ({ year: y.label, subject: s.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const set = await getPublicTrySet(params.year, params.subject)
  return {
    title: set ? `Try ${set.displayLabel} ${set.subjectName}, free` : 'Try it free',
    robots: { index: false, follow: true },
  }
}

export default async function TrySubjectPage({ params }: Props) {
  const set = await getPublicTrySet(params.year, params.subject)
  if (!set) notFound()

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <Link
          href={`/try/${set.yearLabel}`}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-muted hover:text-ink"
        >
          <span aria-hidden>←</span>&nbsp;Change subject
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: set.colourToken, color: inkOn(set.colourToken) }}
          >
            {set.subjectName}
          </span>
          <span className="text-sm text-muted">{set.displayLabel}</span>
        </div>
        <h1 className="mt-2 font-heading text-2xl font-black text-ink sm:text-3xl">{set.topicTitle}</h1>

        <TryQuestions
          questions={set.questions}
          topicTitle={set.topicTitle}
          yearLabel={set.displayLabel}
          subjectName={set.subjectName}
          className="mt-6"
        />

        {set.topicPath ? (
          <p className="mt-6 text-center text-sm">
            <Link href={set.topicPath} className="font-semibold text-brand-700 underline">
              Read the full lesson on {set.topicTitle}
            </Link>
          </p>
        ) : null}

        <p className="mt-4 text-center text-sm text-muted">
          {set.otherTopics > 0 ? (
            <>
              A new {set.subjectName} topic appears here every day.{' '}
            </>
          ) : null}
          <Link
            href={`/curriculum/${set.subjectSlug}/${set.yearLabel}`}
            className="font-semibold text-brand-700 underline"
          >
            See every {set.displayLabel} {set.subjectName} topic
          </Link>
        </p>
      </main>
    </div>
  )
}
