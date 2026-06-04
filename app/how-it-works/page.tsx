import type { Metadata } from 'next'
import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'

export const metadata: Metadata = {
  title: 'How it works — DECIFER Learning',
  description: 'A six-stage quality pipeline, game mechanics that motivate, and a parent dashboard that shows you exactly where to help.',
}

const STEPS = [
  {
    number: '1',
    title: 'Pick a topic on the world map',
    body: 'Your child lands on a world map divided into zones by subject. Topics unlock in sequence — complete one to reveal the next. Each zone ends with a Zone Guardian boss battle.',
  },
  {
    number: '2',
    title: 'Learn with clear explanations',
    body: 'Every topic starts with a concise lesson — worked examples, diagrams, and simple language matched to the year group. Children can re-read it any time.',
  },
  {
    number: '3',
    title: 'Practise before the quiz',
    body: 'Interactive practice games (fill-in-the-blank, drag-and-drop, speed rounds) give children a low-stakes chance to try ideas before the scored quiz.',
  },
  {
    number: '4',
    title: 'Quiz with hints and hearts',
    body: '10 questions, three hint levels, and three hearts per attempt. Hints cost points; using them is the right choice when stuck — not a failure. 70%+ to pass.',
  },
  {
    number: '5',
    title: 'Earn points, cards, and badges',
    body: 'Correct answers earn points. Every passed quiz drops a Discovery Card (five rarities, 30+ in the set). Badges unlock for streaks, perfect scores, and topic mastery.',
  },
  {
    number: '6',
    title: 'Spaced repetition brings topics back',
    body: 'Completed topics are scheduled for review using the SM-2 algorithm. The dashboard shows children which topics to revisit today — keeping knowledge fresh without cramming.',
  },
]

const QUALITY_STEPS = [
  { step: 'RAG generation', detail: 'Questions are written using only verified curriculum source material — not hallucinated facts.' },
  { step: 'Code verification', detail: 'Maths answers are checked by SymPy, science by Pint and ChemPy, English by LanguageTool. The AI never provides the canonical answer.' },
  { step: 'Consensus check', detail: 'A second AI call at temperature 0 confirms correctness and tier alignment independently.' },
  { step: 'Constitutional critique', detail: 'A third pass checks age-appropriateness, cultural sensitivity, distractor quality, and hint progression.' },
  { step: 'Semantic deduplication', detail: 'Vector similarity search ensures no child sees a near-identical question twice.' },
  { step: 'Confidence threshold', detail: 'Only questions scoring ≥ 85% (maths/science) or ≥ 90% (English factual) are published.' },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <DeciferLogo size="sm" product="Learning" />
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm font-semibold text-maths hover:underline">Pricing</Link>
            <Link href="/register" className="h-9 rounded-lg bg-maths px-4 text-sm font-semibold text-white flex items-center">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-ink">How it works</h1>
          <p className="mt-3 text-lg text-muted">
            Game mechanics that motivate. Content quality that parents can trust.
          </p>
        </div>

        {/* Child loop */}
        <h2 className="mt-14 font-heading text-2xl font-bold text-ink">The child&apos;s loop</h2>
        <div className="mt-6 space-y-6">
          {STEPS.map((s) => (
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
          Every question passes six automated stages before it reaches a child. No human moderation queue — the pipeline is the CMS.
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

        {/* Parent dashboard */}
        <h2 className="mt-14 font-heading text-2xl font-bold text-ink">The parent view</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Parents get a real-time view of each child&apos;s progress: topics completed, current streak, weak areas (identified by high error rate or hint usage), and recommended next steps. Screen-time controls let you set daily limits and allowed hours. Everything is per-child.
        </p>

        <div className="mt-10 rounded-2xl bg-maths/5 border border-maths/20 p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-ink">Try it free</h2>
          <p className="mt-2 text-muted">3 Maths topics, no card required.</p>
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
