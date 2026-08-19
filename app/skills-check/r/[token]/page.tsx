import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAttemptView, prettyYear, prettySubject } from '@/lib/skills-check/server'
import { UnlockForm } from './UnlockForm'

// The result page.
//
// Free above the gate: the working level and two lines of summary. Behind the
// gate: which areas, their verdicts, and what to do next.
//
// The gate is enforced on the server in getAttemptView, which returns
// `report: null` until a parent has given their email. The gated content is
// never sent to the browser, so there is no CSS or devtools trick that reveals
// it.

export const dynamic = 'force-dynamic'

// A result belongs to one family and says something about one child. It has no
// business in a search index.
export const metadata: Metadata = {
  title: 'Your child’s Skills Check result',
  robots: { index: false, follow: false },
}

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  secure: { label: 'Secure', className: 'bg-success/10 text-success' },
  developing: { label: 'Developing', className: 'bg-warning/15 text-ink' },
  needs_work: { label: 'Needs work', className: 'bg-error/10 text-error' },
}

export default async function SkillsCheckResultPage({ params }: { params: { token: string } }) {
  const view = await getAttemptView(params.token)
  if (!view) notFound()

  const year = prettyYear(view.yearLabel)
  const subject = prettySubject(view.subjectName)

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">
          {year} {view.subjectName} · Skills Check
        </p>
        <h1 className="text-2xl font-bold leading-snug text-ink sm:text-3xl">
          {view.teaser.headline}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          {view.teaser.strongestLine} {view.teaser.gapLine}
        </p>
      </header>

      {view.report ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">The four areas we checked</h2>
            <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-surface">
              {view.report.strands.map((s) => {
                const style = VERDICT_STYLE[s.verdict] ?? {
                  label: s.verdict,
                  className: 'bg-black/5 text-ink',
                }
                return (
                  <li key={s.strandTopicId} className="flex items-center justify-between gap-3 p-4">
                    <span className="text-[15px] font-medium text-ink">{s.strandTitle}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-xs text-ink-2">
                        {s.correct}/{s.total}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${style.className}`}
                      >
                        {style.label}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="text-sm text-ink-2">
              Scored {view.report.rawScore} out of {view.report.totalItems}.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">What to do next</h2>
            {view.report.nextSteps.length === 0 ? (
              <p className="text-[15px] leading-relaxed text-ink-2">
                Every area we checked came out secure. The useful next step is the check for the
                year above, to find where the stretch actually starts.
              </p>
            ) : (
              <ol className="space-y-2">
                {view.report.nextSteps.map((step, i) => (
                  <li
                    key={step.strandTitle}
                    className="rounded-xl border border-black/5 bg-surface p-4"
                  >
                    <span className="font-mono text-xs text-ink-2">Step {i + 1}</span>
                    <p className="mt-1 text-[15px] font-medium text-ink">{step.strandTitle}</p>
                    {step.topicUrl && (
                      <Link
                        href={step.topicUrl}
                        className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-ember hover:underline"
                      >
                        See what this covers
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-ember/20 bg-brand-50 p-5">
            <h2 className="text-lg font-semibold text-ink">Work on the weak areas</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Decifer teaches these topics directly, and tracks whether the gaps close. Setting up
              an account takes about two minutes.
            </p>
            <Link
              href="/register"
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Create a free account
            </Link>
          </section>
        </>
      ) : (
        <UnlockForm token={view.token} year={year} subject={subject} />
      )}

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">
          What this does and does not tell you
        </h2>
        <p className="text-sm leading-relaxed text-ink-2">
          This is twenty questions on one day, covering four areas of the {year} curriculum. It
          says whether your child is secure on those four areas, and nothing about the rest.
        </p>
        <p className="text-sm leading-relaxed text-ink-2">
          It is not an IQ test and not a standardised score. There is no percentile here and no
          comparison with other children, because a score like that only means something when a
          test has first been given to a large, representative sample. A tired morning moves this
          result.
        </p>
      </section>

      <nav className="border-t border-black/5 pt-5">
        <Link
          href={`/skills-check/${view.subjectSlug}/${view.yearLabel}`}
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          Take the {year} {view.subjectName} check again
        </Link>
      </nav>
    </div>
  )
}
