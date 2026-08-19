import type { Metadata } from 'next'
import Link from 'next/link'
import { listPublishedChecks, prettyYear } from '@/lib/skills-check/server'

// The Skills Check hub.
//
// Search intent this targets: a parent who wants to know whether their child is
// where they should be. They search things like "year 4 maths assessment",
// "is my child behind in maths", "free maths test year 5". The copy answers that
// question directly and says what the check is not, because the honest framing
// is also the one that survives contact with a sceptical parent.
export const metadata: Metadata = {
  title: { absolute: 'Free Skills Check: Is Your Child on Track for Their Year?' },
  description:
    'A free 10-minute check against the UK National Curriculum. Find out whether your child is secure, developing or behind in maths and English for their school year. No account needed.',
  alternates: { canonical: '/skills-check' },
  openGraph: {
    title: 'Free Skills Check | Decifer Learning',
    description:
      'Ten minutes, twenty questions, and a clear answer on whether your child is on track for their school year.',
    url: 'https://www.deciferlearning.com/skills-check',
  },
}

export const revalidate = 3600

export default async function SkillsCheckHubPage() {
  const checks = await listPublishedChecks()

  const bySubject = new Map<string, typeof checks>()
  for (const c of checks) {
    const list = bySubject.get(c.subjectName) ?? []
    list.push(c)
    bySubject.set(c.subjectName, list)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          Is your child on track for their year?
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Twenty questions, about ten minutes, and no account needed. Your child answers, and
          you get a straight answer on where they actually are against the UK National
          Curriculum for their school year.
        </p>
      </header>

      {checks.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-surface p-5">
          <p className="text-[15px] text-ink-2">
            The first checks are being finished now. Every question is read by a person before a
            check goes live, so this takes a little longer than it might.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...bySubject.entries()].map(([subjectName, list]) => (
            <section key={subjectName} className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">{subjectName}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {list.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/skills-check/${c.subjectSlug}/${c.yearLabel}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl border border-black/5 bg-surface px-3 py-3 text-center text-sm font-semibold text-ink transition-colors hover:border-ember/40 hover:bg-brand-50"
                    >
                      {prettyYear(c.yearLabel)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">How it works</h2>
        <ol className="space-y-2 text-[15px] leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink">1.</strong> Pick your child&apos;s subject and school
            year.
          </li>
          <li>
            <strong className="text-ink">2.</strong> They answer twenty questions. Four areas of
            the curriculum, five questions each. No timer, no score on screen, nothing to lose.
          </li>
          <li>
            <strong className="text-ink">3.</strong> You get their working level straight away,
            and the full breakdown by email.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">What we check, and how</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Each check samples four areas of your child&apos;s year in the National Curriculum. In
          every area they get one question from the year below, three from their own year, and
          one from the year above. That spread is what lets twenty questions say whether a child
          is working below, within, or beyond their year, rather than just counting right
          answers.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          We report the way schools do. Secure, developing, or needs work, area by area, against
          what the curriculum expects by the end of that year.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">What this is not</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          It is not an IQ test. It does not produce a score out of 100, a percentile, or any
          ranking against other children. Those numbers only mean something when a test has been
          given to a large, representative sample first, and this one has not. Anyone offering
          you a free online IQ score for your child is inventing the number.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          It is also twenty questions on one day. A tired morning moves the result. Treat it as a
          useful signal about what to work on next, not a verdict on your child.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Common questions</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-2">
          <div>
            <p className="font-semibold text-ink">Do I need an account?</p>
            <p>
              No. Your child can take the check straight away. We ask for your email only when
              you want the full breakdown and the suggested next steps.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">What do you store about my child?</p>
            <p>
              Nothing that identifies them. No name, no date of birth, no school. We keep the
              answers and the school year, and that is all. The only personal detail anywhere in
              this is your own email address, and every report email has a one-click link to
              delete it.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Which curriculum is this?</p>
            <p>
              The English National Curriculum, which is what British curriculum schools in the
              UAE follow too.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Can my child do it more than once?</p>
            <p>
              Yes, and it is worth waiting about six weeks between goes. Questions are drawn
              fresh each time, so a repeat is not a memory test.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
