import type { Metadata } from 'next'
import Link from 'next/link'
import { WorkedExample } from '@/components/reasoning/WorkedExample'
import { TOTAL_ITEMS } from '@/lib/reasoning/plan'

// "CAT4 practice test", "CAT4 explained", "CAT4 Dubai".
//
// This is the highest-intent page on the site: a UAE parent whose child has been
// entered for a CAT4, or who has just been handed a CAT4 report and cannot read
// it. We are a UAE company selling to UAE parents, so this is home ground.
//
// WHAT THIS PAGE MUST NOT DO (scope §13): claim to predict or replicate a CAT4
// result, promise an admissions outcome, or print a score on the SAS scale. It
// explains what the CAT4 is, explains what an SAS actually means, and offers
// practice at the non-verbal half. That is the honest version, and it is also
// the version that does not fall over when a parent checks.

export const metadata: Metadata = {
  title: { absolute: 'CAT4 Explained for UAE Parents, and Free Non-Verbal Practice' },
  description:
    'What the CAT4 is, why Dubai and Abu Dhabi schools use it, what an SAS score of 100 or 115 actually means, and a free adaptive practice test for the non-verbal battery.',
  alternates: { canonical: '/reasoning/cat4-practice' },
  openGraph: {
    title: 'CAT4 Explained for UAE Parents | Decifer Learning',
    description:
      'What the four CAT4 batteries are, what an SAS score means, and free non-verbal reasoning practice.',
    url: 'https://www.deciferlearning.com/reasoning/cat4-practice',
  },
}

export const revalidate = 3600

const BATTERIES = [
  {
    name: 'Verbal reasoning',
    what: 'Reasoning with words. Word relationships and verbal classification.',
    ours: false,
  },
  {
    name: 'Non-verbal reasoning',
    what: 'Reasoning about shapes and patterns, with no reading involved.',
    ours: true,
  },
  {
    name: 'Quantitative reasoning',
    what: 'Reasoning with numbers, which is not the same thing as being good at arithmetic.',
    ours: false,
  },
  {
    name: 'Spatial ability',
    what: 'Picturing shapes moving, turning and folding.',
    ours: false,
  },
]

export default function Cat4PracticePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">
          For UAE parents · free practice · no account
        </p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          The CAT4, explained, and free non-verbal practice
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          The CAT4 is a cognitive abilities test. British curriculum schools across Dubai, Abu
          Dhabi and Sharjah use it for admissions, for setting and streaming, and as a baseline
          they report against. Children sitting it for Year 7 entry to a selective school usually
          take it in Year 5 or Year 6.
        </p>
        <Link
          href="/reasoning/non-verbal"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          Practise non-verbal reasoning free
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">The four parts</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          A CAT4 has four batteries. It is not a test of what a child has been taught, which is
          the point of it: a school uses it to see potential that a maths book might be hiding.
        </p>
        <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-surface">
          {BATTERIES.map((b) => (
            <li key={b.name} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold text-ink">{b.name}</span>
                {b.ours && (
                  <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-ember">
                    What our free test covers
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{b.what}</p>
            </li>
          ))}
        </ul>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Our free test covers the non-verbal battery only. We would rather do one part properly
          than four badly, and non-verbal is the part that generates cleanly enough for us to
          promise every question has exactly one defensible answer.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">
          What an SAS score of 100 or 115 actually means
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          A CAT4 report gives a Standard Age Score, or SAS. It is built so that the average child
          of that age scores 100, and so that about two thirds of children fall between 85 and
          115. It is age-adjusted, which is why a child born in August is not penalised against
          one born in September.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          So an SAS is not a mark out of 200 and not a percentage. It is a position: 115 means
          well above the average for children the same age, 100 means right about average, 85
          means well below. It only means that because GL first gave the test to a large,
          carefully chosen national sample. The sample is the whole reason the number says
          anything.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          <strong className="text-ink">Which is why our test does not give you one.</strong> We
          have no such sample. Any SAS-shaped number from a free online test, ours or anyone
          else&apos;s, is invented. What we give you instead is how many of each kind of puzzle
          your child got right, the hardest level they solved, and how long they took.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">What our test is, honestly</h2>
        <ul className="space-y-2 text-[15px] leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink">It is:</strong> {TOTAL_ITEMS} adaptive non-verbal
            reasoning puzzles of the same four kinds a CAT4 non-verbal battery uses, free, and
            about twelve minutes.
          </li>
          <li>
            <strong className="text-ink">It is not:</strong> a CAT4, a mock CAT4, or a
            prediction of one. It is not made by GL Assessment, it is not endorsed by them, and
            nothing it tells you will decide an admissions outcome.
          </li>
          <li>
            <strong className="text-ink">It is useful for:</strong> finding out whether this kind
            of puzzle is unfamiliar to your child, which is worth knowing before test day. Most
            of the gap on a first sitting is unfamiliarity, not ability.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">A non-verbal question, so you can see</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          This is a matrix: one rule across the rows, another down the columns, and the missing
          square obeys both.
        </p>
        <WorkedExample type="matrix" level={4} seed="cat4-sample" />
      </section>

      <section className="space-y-3 rounded-2xl border border-ember/20 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-ink">Should you coach for a CAT4?</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Schools use the CAT4 precisely because it is meant to be hard to coach. What practice
          genuinely fixes is familiarity: a child who has never seen a matrix puzzle loses time
          working out what is being asked, and time is half of what these tests measure. An hour
          of exposure is worth a lot. Ten hours of drilling is not, and it makes the result less
          useful to the school that has to teach your child.
        </p>
      </section>

      <nav className="flex flex-wrap gap-4 border-t border-black/5 pt-5">
        <Link
          href="/reasoning/non-verbal"
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          Take the free non-verbal test
        </Link>
        <Link
          href="/reasoning/11-plus"
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          11+ non-verbal reasoning
        </Link>
      </nav>
    </div>
  )
}
