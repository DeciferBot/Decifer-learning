import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublishedCheck, listPublishedChecks, prettyYear, prettySubject } from '@/lib/skills-check/server'
import { CheckRunner } from './CheckRunner'

// One landing page per subject and year. These are the pages meant to rank.
//
// The query a parent types is "year 4 maths assessment" or "is my year 5 behind
// in maths", so the title leads with the year and subject and the page answers
// that question above the fold. The check itself is on the same page: making
// someone click through to the thing they came for loses most of them.

type Params = { subject: string; year: string }

export const revalidate = 3600

// Prerender every published check. There are at most a few dozen, and the list
// comes from ONE query rather than one per page — the build-time DB storm that
// the 364-URL curriculum sitemap ran into is the reason this is a single call.
export async function generateStaticParams(): Promise<Params[]> {
  try {
    const checks = await listPublishedChecks()
    if (checks.length === 0) {
      console.warn('[skills-check] no published checks found; no landing pages prerendered')
    }
    return checks.map((c) => ({ subject: c.subjectSlug, year: c.yearLabel }))
  } catch (err) {
    // A DB blip at build time should not fail the build. These pages still
    // render on demand.
    //
    // It must not pass silently either. Swallowing this once shipped a build
    // with zero landing pages and no hint as to why: the route still showed as
    // SSG, just with nothing under it. Log loudly so a build that quietly drops
    // every page meant to rank is visible in the build output.
    console.error('[skills-check] generateStaticParams failed, prerendering no landing pages:', err)
    return []
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const check = await getPublishedCheck(params.subject, params.year)
  if (!check) return { title: 'Skills Check' }

  const year = prettyYear(check.yearLabel)
  const subject = prettySubject(check.subjectName)
  const canonical = `/skills-check/${check.subjectSlug}/${check.yearLabel}`

  return {
    title: { absolute: `Free ${year} ${check.subjectName} Assessment: Is Your Child on Track?` },
    description: `A free ${check.itemCount}-question check of ${year} ${subject} against the UK National Curriculum. Find out in ten minutes whether your child is secure, developing or behind. No account needed.`,
    alternates: { canonical },
    openGraph: {
      title: `Free ${year} ${check.subjectName} Skills Check | Decifer Learning`,
      description: `Ten minutes, ${check.itemCount} questions, and a clear answer on whether your child is on track for ${year} ${subject}.`,
      url: `https://www.deciferlearning.com${canonical}`,
    },
  }
}

export default async function SkillsCheckLandingPage({ params }: { params: Params }) {
  const check = await getPublishedCheck(params.subject, params.year)
  if (!check) notFound()

  const year = prettyYear(check.yearLabel)
  const subject = prettySubject(check.subjectName)

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">
          Free · no account · about 10 minutes
        </p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          {year} {check.subjectName} Skills Check
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          {check.itemCount} questions that show whether your child is secure on what the National
          Curriculum expects in {year} {subject}. Hand them the screen and let them answer. You
          get their working level as soon as they finish.
        </p>
      </header>

      <CheckRunner
        subject={check.subjectSlug}
        year={check.yearLabel}
        yearLabel={year}
        subjectName={check.subjectName}
        itemCount={check.itemCount}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">What the {check.itemCount} questions cover</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Four areas of the {year} curriculum, five questions in each. Within every area your
          child gets one question from the year below, three from {year}, and one from the year
          above. That spread is what lets a short check say whether they are working below,
          within, or beyond their year, instead of only counting right answers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">What you get back</h2>
        <ul className="space-y-2 text-[15px] leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink">Straight away, free:</strong> their working level for{' '}
            {year} {subject}, and which area they were strongest in.
          </li>
          <li>
            <strong className="text-ink">By email:</strong> every area marked secure, developing
            or needs work, and up to three specific things to work on next, each linked to a free
            lesson.
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">Before you start</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          This is not an IQ test and it does not give a score out of 100 or a percentile. It
          checks what your child has learned, not how clever they are, and it never compares them
          with another child.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          We store nothing that identifies your child. No name, no date of birth, no school.
        </p>
      </section>

      <nav className="border-t border-black/5 pt-5">
        <Link
          href="/skills-check"
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          See checks for other years and subjects
        </Link>
      </nav>
    </div>
  )
}
