import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { BookOpen, PencilLine, Zap } from '@/components/ui/icons'
import type { ReactNode } from 'react'
import type { ComponentType, SVGProps } from 'react'
type IconComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export const metadata = {
  title: 'How Decifer works — Decifer Learning',
  description:
    'The thinking behind Decifer: the three-stage Learn, Practise, Quiz loop, adaptive difficulty, spaced repetition, and how content maps to the UK National Curriculum from Year 1 to GCSE.',
  alternates: { canonical: '/help/how-decifer-works' },
}

export default function HowDeciferWorksPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/help" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">
          ← All guides
        </Link>
        <h1 className="font-heading text-3xl font-bold text-ink">How Decifer works</h1>
        <p className="mt-2 text-muted">
          The thinking behind the name, the structure, and the learning approach.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">The name and the mark</h2>
        <div className="flex items-start gap-6">
          <DeciferLogo size="lg" product="Learning" />
          <div className="text-sm text-muted space-y-2">
            <p>The name <strong className="text-ink">Decifer</strong> is a deliberate play on <em>decipher</em>: to understand, to decode, to make sense of something. That&apos;s exactly what learning feels like when it works.</p>
            <p>The brand mark, the offset <strong className="text-ink">&lt; &gt;</strong>, represents two people in dialogue. The <strong className="text-ink">&lt;</strong> is the learner: asking, exploring, opening a question. The <strong className="text-ink">&gt;</strong> is the guide: responding, explaining, giving feedback.</p>
            <p>The vertical offset shows that this is a conversation in motion, not a static exchange. Learning happens between those two brackets.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">The three-stage learning loop</h2>
        <p className="text-sm text-muted">Every topic on Decifer follows the same pattern, which mirrors how effective learning actually works.</p>
        <div className="space-y-3">
          {LOOP_STAGES.map((stage) => (
            <div key={stage.label} className="flex items-start gap-4 rounded-xl border border-black/5 bg-surface px-4 py-4 shadow-sm">
              <stage.icon className="mt-0.5 w-5 h-5 flex-none text-muted" aria-hidden />
              <div>
                <p className="font-heading font-semibold text-ink">{stage.label}</p>
                <p className="mt-1 text-sm text-muted">{stage.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">Adaptive difficulty</h2>
        <div className="text-sm text-muted space-y-2">
          <p>Within a quiz session, Decifer adjusts the difficulty of questions based on how well you&apos;re doing. If you&apos;re getting questions right consistently, slightly harder questions will appear. If you&apos;re struggling, slightly easier ones will surface.</p>
          <p>This is not the same as changing your level. Your tier (Sprout, Explorer, or Lightning) stays consistent across topics. The adaptive layer is a small adjustment within the session to keep things at the right level of challenge without overwhelming or boring you.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">Spaced repetition</h2>
        <div className="text-sm text-muted space-y-2">
          <p>After you pass a topic quiz, Decifer schedules it for review. The timing is based on the SM-2 spaced repetition algorithm, the same principle used by the most effective flashcard tools.</p>
          <p>A &ldquo;Time to revisit&rdquo; card will appear on your dashboard when a topic is due for review. Revisiting is quicker than the original quiz and is the most effective way to make sure the learning sticks long-term.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">Curriculum structure</h2>
        <div className="text-sm text-muted space-y-2">
          <p>All content follows the <strong className="text-ink">UK National Curriculum</strong>, from Year 1 to Year 11. Five subjects are covered: Maths, English, Science, History and Geography. Maths, English and Science run all the way through to GCSE (Year 11); History and Geography cover Years 1 to 9.</p>
          <p>Every topic is published only once it has passed the full quality pipeline, and new topics are added continuously as they clear all checks.</p>
          <p>Topics are grouped into zones. Each zone has a theme and a Zone Guardian boss. Complete all the topics in a zone to unlock the Guardian challenge and earn a chance at a Legendary Discovery Card.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-ink">The emotional principle</h2>
        <div className="rounded-2xl bg-brand-50 p-5 text-sm text-muted space-y-2">
          <p className="font-heading font-bold text-ink text-base">I tried → I improved → I can see progress → I want to continue.</p>
          <p>That loop is what Decifer is designed to create: genuine progress and growing confidence that make a child want to continue.</p>
          <p>Mistakes are normal. Hints are there to help. Retrying is always allowed. There is no shame state in Decifer.</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/help/content-quality" className="font-semibold text-brand hover:underline">
          Content quality →
        </Link>
        <Link href="/help/gamification" className="font-semibold text-brand hover:underline">
          Gamification explained →
        </Link>
        <Link href="/help" className="text-muted hover:text-ink hover:underline">
          All guides
        </Link>
      </div>
    </div>
  )
}

const LOOP_STAGES: { icon: IconComp; label: string; body: string }[] = [
  {
    icon: BookOpen,
    label: 'Learn',
    body: 'The topic is explained clearly with worked examples. This stage is about building a mental model before any pressure to perform. You can re-read it as many times as you like.',
  },
  {
    icon: PencilLine,
    label: 'Practise',
    body: 'Guided exercises let you apply the idea with support. Practise builds the connection between understanding and doing, which is what makes the quiz feel achievable rather than scary.',
  },
  {
    icon: Zap,
    label: 'Quiz',
    body: 'The quiz tests real understanding with 10 questions across three difficulty tiers. Hints are always available. Retrying is always allowed. Your highest score counts.',
  },
]
