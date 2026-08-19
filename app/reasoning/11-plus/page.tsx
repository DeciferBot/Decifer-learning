import type { Metadata } from 'next'
import Link from 'next/link'
import { WorkedExample } from '@/components/reasoning/WorkedExample'
import { TOTAL_ITEMS } from '@/lib/reasoning/plan'
import type { Level, ReasoningItemType } from '@/lib/reasoning/generate'

// "11 plus non-verbal reasoning practice", "11+ non-verbal reasoning questions".
//
// The angle: every question type, with a real example of each. That is the page
// parents actually want and the one competitors pad out with stock images.
//
// WHAT THIS PAGE MUST NOT DO (scope §13): sell itself as 11+ preparation with an
// outcome promise. It shows the question types and offers free practice. It does
// not claim to get anyone into a grammar school.
//
// Note on figures we do NOT print: the commonly quoted "80 questions in 60
// minutes" for a GL non-verbal paper rests on a single source in our research,
// and paper structure varies by consortium and by year. Better to describe the
// question types, which are stable, than to print a number a parent might plan
// around and find wrong.

export const metadata: Metadata = {
  title: { absolute: '11+ Non-Verbal Reasoning: Every Question Type, With Examples' },
  description:
    'The non-verbal reasoning question types on an 11+ paper — sequences, matrices, analogies and odd-one-out — each with a worked example, plus a free adaptive practice test.',
  alternates: { canonical: '/reasoning/11-plus' },
  openGraph: {
    title: '11+ Non-Verbal Reasoning Explained | Decifer Learning',
    description:
      'Every non-verbal question type with a worked example, and a free adaptive practice test.',
    url: 'https://www.deciferlearning.com/reasoning/11-plus',
  },
}

export const revalidate = 3600

const TYPES: {
  type: ReasoningItemType
  level: Level
  seed: string
  heading: string
  body: string
}[] = [
  {
    type: 'sequence',
    level: 3,
    seed: '11plus-sequence',
    heading: 'Sequences: what comes next',
    body: 'A row of shapes where something changes each step. At the easy end one thing changes. At the hard end three do at once, and one of them is usually a rotation.',
  },
  {
    type: 'matrix',
    level: 4,
    seed: '11plus-matrix',
    heading: 'Matrices: complete the grid',
    body: 'A three-by-three grid with one square blank. One rule runs across, a different rule runs down. This is the type most children lose marks on, because they find one rule and stop.',
  },
  {
    type: 'analogy',
    level: 3,
    seed: '11plus-analogy',
    heading: 'Analogies: A is to B as C is to what',
    body: 'A change is shown once, then has to be applied to a new shape. The trap is picking the option that looks most like the second shape instead of the one that has had the same thing done to it.',
  },
  {
    type: 'odd_one_out',
    level: 3,
    seed: '11plus-odd',
    heading: 'Odd one out',
    body: 'Five shapes, four with something in common. Deliberately busy: several things vary, but only one of them splits four against one.',
  },
]

export default function ElevenPlusPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-2">
          Free practice · no account · about 12 minutes
        </p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          11+ non-verbal reasoning: every question type, with examples
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Non-verbal reasoning is the part of an 11+ with no words and no arithmetic in it. It is
          shapes, and it is testing whether a child can spot a rule and apply it. GL Assessment
          is now the dominant 11+ provider, after CEM stopped offering paper tests from September
          2023 and most grammar schools moved across.
        </p>
        <Link
          href="/reasoning/non-verbal"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          Take the free practice test
        </Link>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-ink">The question types</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Four kinds, each with a real example and the answer marked. Every example on this page
          is produced by the same code that runs our practice test, so nothing here is a
          simplified version of what your child will meet.
        </p>
        {TYPES.map((t) => (
          <section key={t.seed} className="space-y-3">
            <h3 className="text-lg font-semibold text-ink">{t.heading}</h3>
            <p className="text-[15px] leading-relaxed text-ink-2">{t.body}</p>
            <WorkedExample type={t.type} level={t.level} seed={t.seed} />
          </section>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">What practice actually helps with</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Two things, and neither is what people expect. The first is knowing what is being
          asked: a child seeing a matrix for the first time spends most of their thinking working
          out the format rather than the puzzle. The second is speed. These papers are tight, and
          a child who can do every question but only at their own pace will not finish.
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          What practice does not do is raise the ceiling much. Anyone promising that is selling
          something. We are not going to tell you this test will get your child into a school.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-ember/20 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-ink">Our free test</h2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          {TOTAL_ITEMS} puzzles across those four types, about twelve minutes, and it adapts: a
          right answer makes the next one harder. You get the level reached free, and a breakdown
          by question type with timings by email. No IQ number and no percentile, because a free
          test cannot honestly produce one.
        </p>
        <Link
          href="/reasoning/non-verbal"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-ember px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          Start the test
        </Link>
      </section>

      <nav className="flex flex-wrap gap-4 border-t border-black/5 pt-5">
        <Link
          href="/reasoning/cat4-practice"
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          The CAT4, explained
        </Link>
        <Link
          href="/skills-check"
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          Check maths and English against their school year
        </Link>
      </nav>
    </div>
  )
}
