import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAttemptView } from '@/lib/reasoning/server'
import { formatMs } from '@/lib/reasoning/score'
import { UnlockForm } from './UnlockForm'

// The result page.
//
// Free above the gate: the level reached and two lines. Behind the gate: the
// per-type scores and levels, the timings, and what to practise.
//
// The gate is enforced on the server in getAttemptView, which returns
// `report: null` until a parent has given their email. The gated content is
// never sent to the browser, so there is no CSS or devtools trick that reveals
// it.

export const dynamic = 'force-dynamic'

// A result belongs to one family and says something about one child. It has no
// business in a search index.
export const metadata: Metadata = {
  title: 'Your child’s reasoning result',
  robots: { index: false, follow: false },
}

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'bg-success/10 text-success' },
  developing: { label: 'Developing', className: 'bg-warning/15 text-ink' },
  needs_practice: { label: 'Needs practice', className: 'bg-error/10 text-error' },
}

export default async function ReasoningResultPage({ params }: { params: { token: string } }) {
  const view = await getAttemptView(params.token)
  if (!view) notFound()

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">
          Non-verbal reasoning · result
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
            <h2 className="text-lg font-semibold text-ink">The four kinds of puzzle</h2>
            <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-surface">
              {view.report.types.map((t) => {
                const style = VERDICT_STYLE[t.verdict] ?? {
                  label: t.verdict,
                  className: 'bg-black/5 text-ink',
                }
                return (
                  <li key={t.type} className="flex items-center justify-between gap-3 p-4">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium text-ink">{t.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-2">
                        {t.levelReached > 0
                          ? `Level ${t.levelReached} of ${view.maxLevel} reached`
                          : 'No level reached'}{' '}
                        · typically {formatMs(t.medianTimeMs)} a puzzle
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-xs text-ink-2">
                        {t.correct}/{t.total}
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
              {view.report.rawScore} correct out of {view.report.totalItems}.
              {view.report.slowestTypeLabel && (
                <>
                  {' '}
                  Slowest to work through:{' '}
                  {view.report.slowestTypeLabel.toLowerCase()}. Speed counts on tests like the
                  CAT4 and the 11+, so a type that is right but slow is still worth practising.
                </>
              )}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">What to practise</h2>
            {view.report.practice.length === 0 ? (
              <p className="text-[15px] leading-relaxed text-ink-2">
                Every kind of puzzle came out strong. The useful next step is the same test again
                in four weeks, to see whether it holds.
              </p>
            ) : (
              <ol className="space-y-2">
                {view.report.practice.map((p, i) => (
                  <li key={p.type} className="rounded-xl border border-black/5 bg-surface p-4">
                    <span className="font-mono text-xs text-ink-2">Step {i + 1}</span>
                    <p className="mt-1 text-[15px] font-medium text-ink">{p.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{p.tip}</p>
                    <Link
                      href={p.url}
                      className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-ember hover:underline"
                    >
                      See a worked example
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-ember/20 bg-brand-50 p-5">
            <h2 className="text-lg font-semibold text-ink">Where their schoolwork actually is</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              This says how your child reasons. It says nothing about what they have been taught.
              The Skills Check is the other half: twenty questions against the National
              Curriculum for their school year, also free.
            </p>
            <Link
              href="/skills-check"
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Try the free Skills Check
            </Link>
          </section>
        </>
      ) : (
        <UnlockForm token={view.token} />
      )}

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Why there is no IQ number here</h2>
        <p className="text-sm leading-relaxed text-ink-2">
          This test measures the same kind of thinking an IQ test measures: spotting patterns and
          reasoning about shapes, with nothing taught in it. That much is a fair claim, and it is
          what a CAT4 non-verbal paper measures too.
        </p>
        <p className="text-sm leading-relaxed text-ink-2">
          It does not give an IQ score, a percentile, or any comparison with another child, and
          it should not. An IQ score, and the CAT4&apos;s own SAS score, place a child against a
          large standardised sample of children the same age — that sample is the entire reason
          the number means anything. We have no such sample, so a number on that scale would be
          invented, however good the test is. Anyone offering your child a free online IQ score
          is making it up.
        </p>
        <p className="text-sm leading-relaxed text-ink-2">
          What is above is what actually happened: how many were right, how hard they got, and
          how long they took. It is also {view.report?.totalItems ?? 24} puzzles on one day. A
          tired afternoon moves the result.
        </p>
      </section>

      <nav className="border-t border-black/5 pt-5">
        <Link
          href="/reasoning/non-verbal"
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          Take the test again
        </Link>
      </nav>
    </div>
  )
}
