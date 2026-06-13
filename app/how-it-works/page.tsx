import type { Metadata } from 'next'
import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'

export const metadata: Metadata = {
  title: 'How it works — DECIFER Learning',
  description: 'Decifer gives parents a clear learning map and children a rewarding way to learn. Here is how both sides work.',
  alternates: { canonical: '/how-it-works' },
}

const PARENT_STEPS = [
  {
    number: '1',
    title: 'Create your account and link your child',
    body: 'Sign up as a parent, create a child account, and choose their year group. Takes two minutes. No payment required to start.',
  },
  {
    number: '2',
    title: 'See your child\'s learning map straight away',
    body: 'From the first session you have a live view of what your child has covered, what the curriculum requires for their year, and where their strengths and gaps are. Updated after every session.',
  },
  {
    number: '3',
    title: 'Understand the curriculum, not just the score',
    body: 'Decifer shows you what Year 5 Maths actually covers. What Year 7 English expects. You do not need to know the curriculum already. That is what the learning map is for.',
  },
  {
    number: '4',
    title: 'See where your child shines and where to focus',
    body: 'Topics with high accuracy and repeat completions show up as strengths. Topics with low accuracy or frequent hint use are flagged with the evidence behind the signal, not just a label.',
  },
  {
    number: '5',
    title: 'Get a suggested next step',
    body: 'Every insight includes something specific to do. Not a vague recommendation. Something actionable based on what your child\'s data actually shows.',
  },
]

const CHILD_STEPS = [
  {
    number: '1',
    title: 'Pick a topic on the world map',
    body: 'Your child lands on a world map divided into zones by subject. Topics unlock in sequence. Complete one to reveal the next. Each zone ends with a Zone Guardian boss battle.',
  },
  {
    number: '2',
    title: 'Learn with clear explanations',
    body: 'Every topic starts with a guided lesson. Worked examples, diagrams, and simple language matched to their year group. They can re-read it as many times as they like.',
  },
  {
    number: '3',
    title: 'Practise before the quiz',
    body: 'Interactive practice games give children a low-stakes chance to try ideas before the scored quiz. Fill in the blank, drag and drop, speed rounds.',
  },
  {
    number: '4',
    title: 'Quiz with hints and hearts',
    body: '10 questions, three hint levels, and three hearts per attempt. Using a hint is the right choice when stuck, not a failure. 70% or above to pass.',
  },
  {
    number: '5',
    title: 'Earn points, cards, and badges',
    body: 'Correct answers earn XP. Every passed quiz drops a Discovery Card with five rarities and 30 in the set. Badges unlock for streaks, perfect scores, and topic mastery.',
  },
  {
    number: '6',
    title: 'Topics come back for review',
    body: 'Completed topics are scheduled for review using the SM-2 spaced repetition algorithm. The dashboard shows which topics to revisit today, keeping knowledge fresh without cramming.',
  },
]

const QUALITY_STEPS = [
  {
    step: 'RAG generation',
    detail: 'Questions are written using only verified curriculum source material, not hallucinated facts.',
  },
  {
    step: 'Code verification',
    detail: 'Maths answers are checked by SymPy, science by Pint and ChemPy, English by LanguageTool. The AI never provides the canonical answer.',
  },
  {
    step: 'Consensus check',
    detail: 'A second AI call at temperature zero confirms correctness and tier alignment independently.',
  },
  {
    step: 'Constitutional critique',
    detail: 'A third pass checks age-appropriateness, cultural sensitivity, distractor quality, and hint progression.',
  },
  {
    step: 'Semantic deduplication',
    detail: 'Vector similarity search ensures no child sees a near-identical question twice.',
  },
  {
    step: 'Confidence threshold',
    detail: 'Only questions scoring 85% or above for maths and science, or 90% or above for English factual content, are published.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <DeciferLogo size="sm" product="Learning" />
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm font-semibold text-maths hover:underline">Pricing</Link>
            <Link href="/register" className="flex h-9 items-center rounded-lg bg-maths px-4 text-sm font-semibold text-white">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-ink">How Decifer works</h1>
          <p className="mt-3 text-lg text-muted">
            Your child gets a learning experience built around real progress. You get a clear picture of what they know.
          </p>
        </div>

        {/* Parent view — first */}
        <h2 className="mt-14 font-heading text-2xl font-bold text-ink">What you see as a parent</h2>
        <p className="mt-2 text-sm text-muted">
          Decifer is built for parents first. This is what you get from the moment you link your child&apos;s account.
        </p>
        <div className="mt-6 space-y-6">
          {PARENT_STEPS.map((s) => (
            <div key={s.number} className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-heading text-lg font-bold text-white">
                {s.number}
              </div>
              <div>
                <p className="font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Child loop */}
        <h2 className="mt-14 font-heading text-2xl font-bold text-ink">What your child does</h2>
        <p className="mt-2 text-sm text-muted">
          Every topic follows the same loop. Every step feeds the learning map you see as a parent.
        </p>
        <div className="mt-6 space-y-6">
          {CHILD_STEPS.map((s) => (
            <div key={s.number} className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maths font-heading text-lg font-bold text-white">
                {s.number}
              </div>
              <div>
                <p className="font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quality pipeline */}
        <h2 className="mt-14 font-heading text-2xl font-bold text-ink">The content quality pipeline</h2>
        <p className="mt-2 text-sm text-muted">
          Every question passes six automated stages before it reaches your child. The AI generates content. It does not mark its own work.
        </p>
        <div className="mt-6 divide-y divide-black/5 rounded-2xl border border-black/10 bg-surface">
          {QUALITY_STEPS.map((s) => (
            <div key={s.step} className="flex gap-4 px-5 py-4">
              <span className="shrink-0 text-correct">✓</span>
              <div>
                <p className="text-sm font-semibold text-ink">{s.step}</p>
                <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-maths/20 bg-maths/5 p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-ink">Try it free</h2>
          <p className="mt-2 text-muted">3 Maths topics. No card required.</p>
          <Link
            href="/register"
            className="mt-6 inline-flex h-12 items-center rounded-xl bg-maths px-8 font-semibold text-white"
          >
            Create a free account
          </Link>
        </div>
      </main>
    </div>
  )
}
