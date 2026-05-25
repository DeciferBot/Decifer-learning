import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { RecoveryRedirect } from './RecoveryRedirect'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { GuideCard } from '@/components/ui/GuideCard'
import { LearningJourney } from '@/components/homepage/LearningJourney'
import { QualityPipeline } from '@/components/homepage/QualityPipeline'
import { HeroMockup } from '@/components/homepage/HeroMockup'

export const metadata = {
  title: 'DECIFER Learning — UK National Curriculum for families',
  description:
    'AI-assisted feedback, structured practice, and quality-checked curriculum content for Year 3 and Year 7. Parents can see progress, confidence, and where support is needed.',
}

export default function Home({
  searchParams,
}: {
  searchParams: { code?: string }
}) {
  if (searchParams.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}`)
  }

  return (
    <>
      <Suspense fallback={null}>
        <RecoveryRedirect />
      </Suspense>

      <div className="min-h-screen bg-background">

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-20 border-b border-black/5 bg-background/90 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <DeciferLogo size="sm" product="Learning" />
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-black/5 sm:px-4"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 sm:px-4"
              >
                Get started
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 py-12 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">

            {/* Left: copy */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand">
                UK National Curriculum · Year 3 and Year 7
              </span>

              <h1 className="mt-4 font-heading text-3xl font-black leading-tight text-ink sm:text-4xl lg:text-5xl">
                Structured learning.{' '}
                <span className="text-brand">Progress parents can see.</span>
              </h1>

              <p className="mt-4 text-base leading-relaxed text-muted">
                DECIFER Learning gives children a clear path through every topic — learn, practise, quiz, then see results. AI-assisted feedback supports each step. Parents see the progress behind every session.
              </p>

              {/* Trust chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                {TRUST_CHIPS.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    <span aria-hidden>{chip.icon}</span>
                    {chip.label}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="flex h-12 items-center justify-center rounded-xl bg-brand px-7 font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  Create free account
                </Link>
                <Link
                  href="/help/how-decifer-works"
                  className="flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-7 font-semibold text-ink transition-colors hover:bg-black/5"
                >
                  How it works
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted">No credit card required. Set up in two minutes.</p>
            </div>

            {/* Right: animated parent progress mockup */}
            <HeroMockup />
          </div>
        </section>

        {/* ── The learning loop ────────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-brand">
              The learning loop
            </p>
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              From first explanation to real confidence.
            </h2>
            <p className="mb-10 text-center text-sm text-muted">
              Every topic follows the same clear path. Every step has a purpose.
            </p>

            <LearningJourney />

            <div className="mt-8 rounded-2xl bg-brand-50 px-6 py-4 text-center">
              <p className="font-heading text-sm font-semibold text-ink">
                &ldquo;I tried. I improved. I can see progress. I want to continue.&rdquo;
              </p>
              <p className="mt-1 text-xs text-muted">
                That loop is what DECIFER Learning is built to create.
              </p>
            </div>
          </div>
        </section>

        {/* ── Parent problem ───────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Most tools give your child something to do. Few tell parents what&apos;s working.
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-center text-sm text-muted">
              DECIFER Learning gives parents a real picture of their child&apos;s learning — not just a grade.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PARENT_CARDS.map((card, i) => (
                <div key={i} className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm">
                  <span className="mb-3 block text-2xl" aria-hidden>{card.icon}</span>
                  <p className="font-heading font-semibold text-ink">{card.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Content quality pipeline ─────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-brand">
              Content quality
            </p>
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Quality checked. Before your child sees it.
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-center text-sm text-muted">
              Every question and lesson passes a six-stage process before it is published. Content that does not meet the threshold is blocked — not published.
            </p>

            <QualityPipeline />
          </div>
        </section>

        {/* ── Child / Parent split ─────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Built for children. Visible to parents.
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-center text-sm text-muted">
              Children feel progress. Parents see the learning behind it.
            </p>
            <div className="grid gap-5 md:grid-cols-2">

              {/* Child column */}
              <div className="rounded-2xl border border-maths/20 bg-maths/5 p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-maths">
                  For children
                </p>
                <h3 className="mb-4 font-heading text-lg font-bold text-ink">
                  A clear, friendly learning experience.
                </h3>
                <ul className="space-y-4">
                  {CHILD_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-none text-lg" aria-hidden>{f.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{f.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{f.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Parent column */}
              <div className="rounded-2xl border border-brand/20 bg-brand-50 p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand">
                  For parents
                </p>
                <h3 className="mb-2 font-heading text-lg font-bold text-ink">
                  A clear, honest view of progress.
                </h3>
                <p className="mb-4 text-xs leading-relaxed text-muted">
                  Children see XP, badges, streaks, and topic progress. Parents see the learning behind those rewards — scores, confidence, hint usage, and where more practice is needed.
                </p>
                <ul className="space-y-4">
                  {PARENT_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-none text-lg" aria-hidden>{f.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{f.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{f.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/help/parent-guide"
                  className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-brand/30 px-5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  Read the parent guide{' '}<span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Game-like motivation ─────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Game-like motivation, without losing the learning.
            </h2>
            <p className="mb-2 text-center text-sm text-muted">
              DECIFER Learning uses rewards to support consistency, not to replace learning. Children earn XP, build streaks, unlock badges, and collect Discovery Cards by completing real learning activity.
            </p>
            <p className="mb-10 text-center text-xs text-muted">
              Rewards recognise effort, accuracy, and progress. They are not bought, traded, or used to pressure children.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {GAMIFICATION_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-black/5 bg-background p-5 text-center shadow-sm"
                >
                  <span className="mb-3 block text-3xl" aria-hidden>{item.icon}</span>
                  <p className="mb-1 font-heading font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Topic preview ────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Example topics
            </h2>
            <p className="mb-2 text-center text-sm text-muted">
              Year 3 and Year 7, starting with Maths.
            </p>
            <p className="mb-10 text-center text-xs text-muted">
              Each topic includes a guided lesson, practice exercises, and a quiz. Your child sees only verified, published content.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_TOPICS.map((topic, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm"
                >
                  <div className="h-1.5 w-full" style={{ backgroundColor: topic.color }} aria-hidden />
                  <div className="p-4">
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{ backgroundColor: topic.color }}
                          aria-hidden
                        />
                        <span className="text-xs font-bold uppercase tracking-wide text-muted">
                          {topic.subject}
                        </span>
                      </div>
                      <span className="text-xs text-muted">{topic.yearGroup}</span>
                    </div>
                    <p className="mt-1 font-heading font-bold text-ink">{topic.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{topic.description}</p>
                    <div className="mt-3 flex gap-1.5 text-xs font-semibold">
                      <span className="rounded-lg bg-maths/10 px-2 py-1.5 text-maths">Learn</span>
                      <span className="rounded-lg bg-science/10 px-2 py-1.5 text-science">Practise</span>
                      <span className="rounded-lg bg-lightning/20 px-2 py-1.5 text-ink">Quiz</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link
                href="/register"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-8 font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Create free account to start
              </Link>
            </p>
          </div>
        </section>

        {/* ── Content availability ────────────────────────────────────────── */}
        <section className="bg-surface py-14">
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-2xl border border-black/5 bg-background p-6 text-center shadow-sm md:p-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
                What is available today
              </p>
              <h2 className="mb-4 font-heading text-xl font-bold text-ink md:text-2xl">
                DECIFER Learning is growing in stages.
              </h2>
              <p className="mx-auto mb-6 max-w-lg text-sm leading-relaxed text-muted">
                Maths currently has the deepest coverage for Year 3 and Year 7. English and Science are expanding through the same quality process. Your child will only ever see content that is verified and ready.
              </p>
              <div className="flex flex-wrap justify-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-maths/10 px-4 py-1.5 font-semibold text-maths">
                  ✓ Maths: Year 3 and Year 7
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-english/10 px-4 py-1.5 font-semibold text-english">
                  Expanding: English
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-science/10 px-4 py-1.5 font-semibold text-science">
                  Expanding: Science
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Help and guides ──────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Help and guides
            </h2>
            <p className="mb-10 text-center text-sm text-muted">
              Everything you need to get started and make the most of DECIFER Learning.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <GuideCard
                icon="👨‍👩‍👧"
                title="Parent guide"
                description="How to set up your child's account, track progress, and support their learning."
                href="/help/parent-guide"
                audience="parent"
              />
              <GuideCard
                icon="🎒"
                title="Student guide"
                description="How to use DECIFER Learning, earn XP, collect cards, and keep your streak going."
                href="/help/student-guide"
                audience="student"
              />
              <GuideCard
                icon="< >"
                title="How DECIFER Learning works"
                description="The thinking behind the lessons, practice, and quiz structure."
                href="/help/how-decifer-works"
                audience="general"
              />
              <GuideCard
                icon="⭐"
                title="Gamification explained"
                description="XP, badges, streaks, shields, and Discovery Cards, all explained."
                href="/help/gamification"
                audience="student"
              />
              <GuideCard
                icon="✅"
                title="Content quality"
                description="How DECIFER Learning checks every question and lesson before it reaches your child."
                href="/help/content-quality"
                audience="parent"
              />
              <GuideCard
                icon="💬"
                title="Frequently asked questions"
                description="Answers to the most common questions from parents and students."
                href="/help/faq"
                audience="general"
              />
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="bg-brand-50 py-16">
          <div className="mx-auto max-w-md px-4 text-center">
            <DeciferLogo size="lg" product="Learning" className="mb-6 justify-center" />
            <h2 className="mb-3 font-heading text-2xl font-bold text-ink">
              Start with one topic. See progress from the first session.
            </h2>
            <p className="mb-8 text-sm text-muted">
              No credit card required. Set up takes two minutes. Your child can start learning today.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/register"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Create free account
              </Link>
              <Link
                href="/login"
                className="flex h-12 w-full items-center justify-center rounded-xl border border-black/10 bg-surface font-semibold text-ink transition-colors hover:bg-black/5"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t border-black/5 bg-surface py-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between">
            <DeciferLogo size="xs" product="Learning" />
            <p className="text-xs text-muted">UK National Curriculum. For families.</p>
            <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted sm:justify-start" aria-label="Footer navigation">
              <Link href="/help" className="hover:text-ink">Help</Link>
              <Link href="/help/parent-guide" className="hover:text-ink">Parents</Link>
              <Link href="/help/faq" className="hover:text-ink">FAQ</Link>
              <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
              <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
              <Link href="/login" className="hover:text-ink">Sign in</Link>
            </nav>
          </div>
        </footer>

      </div>
    </>
  )
}

// ── Static content ─────────────────────────────────────────────────────────────

const TRUST_CHIPS = [
  { icon: '🤖', label: 'AI-assisted feedback' },
  { icon: '✅', label: 'Quality-checked content' },
  { icon: '📊', label: 'Parent-visible progress' },
  { icon: '🇬🇧', label: 'UK curriculum-aligned' },
]

const PARENT_CARDS = [
  {
    icon: '📖',
    title: 'See what they studied',
    body: 'Know exactly which topics your child has worked through and when.',
  },
  {
    icon: '📉',
    title: 'Understand where they struggled',
    body: 'Quiz scores and hint usage show where a topic needs more attention.',
  },
  {
    icon: '📈',
    title: 'Track confidence and progress',
    body: 'Accuracy rates and topic completion give a real picture of how learning is going.',
  },
  {
    icon: '🎯',
    title: 'Know what to practise next',
    body: 'Areas needing more time are highlighted clearly. No guessing about where to focus.',
  },
]

const CHILD_FEATURES = [
  {
    icon: '📖',
    title: 'Guided lessons at the right level',
    body: 'Explanations and examples matched to the UK curriculum for their year group.',
  },
  {
    icon: '✏️',
    title: 'Practice with hints and retries',
    body: 'Exercises with up to three hint levels. Retrying is always allowed and never penalised.',
  },
  {
    icon: '⚡',
    title: 'Quizzes with instant feedback',
    body: 'Ten questions per topic. Correct answers are celebrated. Mistakes are explained.',
  },
  {
    icon: '⭐',
    title: 'XP, badges, and Discovery Cards',
    body: 'Progress is rewarded. Cards, streaks, and badges keep learning feeling worthwhile.',
  },
]

const PARENT_FEATURES = [
  {
    icon: '🔗',
    title: 'Linked child account',
    body: 'Create your account, link your child, and see their dashboard straight away.',
  },
  {
    icon: '📊',
    title: 'Topic-level progress',
    body: 'See which topics are started, in progress, or completed, and when.',
  },
  {
    icon: '🎯',
    title: 'Scores and confidence data',
    body: 'Quiz accuracy, hint usage, and streak data give a real view of where your child stands.',
  },
  {
    icon: '📍',
    title: 'Clear next steps',
    body: 'Areas needing practice are highlighted clearly. No guessing about where to focus.',
  },
]

const SAMPLE_TOPICS = [
  {
    title: 'Multiplication Tables',
    subject: 'Maths',
    yearGroup: 'Year 3',
    color: '#6C9EFF',
    description: 'Build speed and confidence with times tables up to 12 × 12.',
  },
  {
    title: 'Algebra Basics',
    subject: 'Maths',
    yearGroup: 'Year 7',
    color: '#6C9EFF',
    description: 'Discover how letters can stand in for numbers and solve equations.',
  },
  {
    title: 'Fractions',
    subject: 'Maths',
    yearGroup: 'Year 3',
    color: '#6C9EFF',
    description: 'Understand halves, thirds, and how to compare and add fractions.',
  },
  {
    title: 'Reading Comprehension',
    subject: 'English',
    yearGroup: 'Year 7',
    color: '#FF8FAB',
    description: 'Explore inference, vocabulary, and deep understanding of texts.',
  },
]

const GAMIFICATION_ITEMS = [
  { icon: '⭐', label: 'XP Points', desc: 'Earn points for every correct answer, quiz, and daily login.' },
  { icon: '🔥', label: 'Streaks', desc: 'Keep your learning streak growing day by day.' },
  { icon: '🏅', label: 'Badges', desc: 'Unlock badges for achievements, perfect scores, and mastery.' },
  { icon: '🃏', label: 'Discovery Cards', desc: 'Collect rare cards that drop after completing quizzes.' },
]
