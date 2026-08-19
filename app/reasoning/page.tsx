import type { Metadata } from 'next'
import Link from 'next/link'
import { TOTAL_ITEMS } from '@/lib/reasoning/plan'
import { MAX_LEVEL } from '@/lib/reasoning/generate'

// The Reasoning Check hub.
//
// Search intent: a parent who has heard of the CAT4 or the 11+ and wants to know
// how their child would do, or who is searching for an "IQ test for kids" and
// deserves a straight answer about why the free ones are inventing the number.
// The copy answers both, and says what this is not, because the honest framing
// is also the one that survives a sceptical reader.

export const metadata: Metadata = {
  title: {
    absolute: 'Free Non-Verbal Reasoning Test for Children | CAT4 and 11+ Practice',
  },
  description:
    'A free 24-question non-verbal reasoning test: shapes, patterns and sequences, the same thinking a CAT4 or 11+ paper measures. Adaptive, no account needed, and no invented IQ score.',
  alternates: { canonical: '/reasoning' },
  openGraph: {
    title: 'Free Non-Verbal Reasoning Test | Decifer Learning',
    description:
      'Twenty-four shape puzzles, about twelve minutes, and an honest read on how your child reasons. No IQ number, because nobody can give you a real one for free.',
    url: 'https://www.deciferlearning.com/reasoning',
  },
}

export const revalidate = 3600

const PAGES = [
  {
    href: '/reasoning/non-verbal',
    title: 'Take the test',
    blurb: `${TOTAL_ITEMS} shape puzzles, about 12 minutes. It gets harder when your child gets one right, and easier when they do not.`,
  },
  {
    href: '/reasoning/cat4-practice',
    title: 'CAT4 practice',
    blurb: 'What the CAT4 is, when your child sits it in the UAE, and how this test relates to the non-verbal battery.',
  },
  {
    href: '/reasoning/11-plus',
    title: '11+ non-verbal reasoning',
    blurb: 'The question types on a GL non-verbal paper, with a worked example of each.',
  },
]

export default function ReasoningHubPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">
          Free · no account · about 12 minutes
        </p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          A free non-verbal reasoning test for children
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Shapes, patterns and sequences. No reading, no arithmetic, nothing your child has to
          have been taught. It measures the same kind of thinking a CAT4 non-verbal paper or an
          11+ non-verbal paper measures, and it takes about twelve minutes.
        </p>
        <Link
          href="/reasoning/non-verbal"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          Start the test
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Where to go</h2>
        <ul className="space-y-2">
          {PAGES.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="block rounded-2xl border border-black/5 bg-surface p-4 transition-colors hover:border-ember/40"
              >
                <span className="text-[15px] font-semibold text-ink">{p.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-2">{p.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">How it works</h2>
        <ol className="space-y-2 text-[15px] leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink">1.</strong> Your child answers {TOTAL_ITEMS} puzzles,
            six of each of four kinds: sequences, matrices, analogies and odd-one-out.
          </li>
          <li>
            <strong className="text-ink">2.</strong> Each right answer moves them up a level,
            each wrong one moves them down. There are {MAX_LEVEL} levels, so the test settles on
            what they can actually do rather than asking everyone the same questions.
          </li>
          <li>
            <strong className="text-ink">3.</strong> You get the level they reached straight
            away, and the breakdown by kind of puzzle, with timings, by email.
          </li>
        </ol>
      </section>

      <section className="space-y-3 rounded-2xl border border-ember/20 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-ink">
          Why there is no IQ score here, and why you should not trust one that is free
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          This test measures the same kind of thinking an IQ test measures. That part is true and
          we will say it plainly. What it does not do is give you a number.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          An IQ score, and the CAT4&apos;s own SAS score, are norm-referenced. They mean something
          only because the test was first given to a large, carefully chosen sample of children
          the same age, and your child is being placed against that sample. We have not done
          that, so any number we printed would be invented. So would anyone else&apos;s free one.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          What you get instead is what actually happened: how many of each kind of puzzle were
          right, the hardest level your child solved, and how long they took. Those are facts
          about the sitting, and they are the useful part anyway.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Before you start: this test is visual</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Non-verbal reasoning means shapes, so a child needs to be able to see them. Every shape
          carries a written description that a screen reader will read out, and nothing depends
          on telling colours apart, because the shapes are filled with stripes, dots or solid
          black rather than colour. The whole test works from a keyboard. Even so, we would
          rather say up front that this one is visual than have anyone find out the hard way.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Common questions</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-2">
          <div>
            <p className="font-semibold text-ink">Do I need an account?</p>
            <p>
              No. We ask for your email only when you want the full breakdown, and every report
              email has a one-click link to delete it.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">What do you store about my child?</p>
            <p>
              Nothing that identifies them. No name, no date of birth, no school. We ask which
              school year they are in, as a range, and that does not even change the test.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Can they take it twice?</p>
            <p>
              Yes. Every puzzle is generated fresh, so no two sittings are the same paper and a
              repeat is not a memory test. Four weeks between goes is about right.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">
              How is this different from the Skills Check?
            </p>
            <p>
              The{' '}
              <Link href="/skills-check" className="font-semibold text-ember hover:underline">
                Skills Check
              </Link>{' '}
              measures what your child has been taught: maths and English against their school
              year. This measures how they think, with nothing taught in it at all. Most parents
              who want one want both.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
