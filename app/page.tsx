import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { RecoveryRedirect } from './RecoveryRedirect'
import { DeciferMark } from '@/components/ui/DeciferMark'
import { GuideCard } from '@/components/ui/GuideCard'

export default function Home({
  searchParams,
}: {
  searchParams: { code?: string }
}) {
  // Forward Supabase PKCE codes to the callback handler
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
            <DeciferMark size="sm" />
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-ink transition-colors hover:bg-black/5"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Get started
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-16 text-center md:pt-24">
          <DeciferMark size="xl" className="mb-8 justify-center" />
          <h1 className="font-heading text-4xl font-black text-ink md:text-5xl lg:text-6xl">
            Learning that<br className="hidden sm:block" />{' '}
            <span className="text-brand">talks back.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted md:text-lg">
            Decifer Learning helps children build confidence through guided lessons,
            practice, quizzes, discovery cards, rewards, and parent-visible progress.
            Built for the UK National Curriculum.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-brand px-8 font-semibold text-white transition-colors hover:bg-brand-600 sm:w-auto"
            >
              Start learning →
            </Link>
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-black/10 bg-white px-8 font-semibold text-ink transition-colors hover:bg-black/5 sm:w-auto"
            >
              Parent sign in
            </Link>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              How it works
            </h2>
            <p className="mb-10 text-center text-sm text-muted">
              Four simple steps from first question to real confidence.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="rounded-2xl bg-background p-5 text-center">
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-lg font-black text-brand font-heading">
                    {i + 1}
                  </span>
                  <p className="mb-1 font-heading font-semibold text-ink">{step.title}</p>
                  <p className="text-xs text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Student journey ─────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              The learning journey
            </h2>
            <p className="mb-10 text-center text-sm text-muted">
              Every topic follows the same clear path.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {JOURNEY_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex min-h-[48px] items-center justify-center rounded-xl border border-black/8 bg-surface px-4 py-2 shadow-sm">
                    <span className="mr-2 text-lg" aria-hidden>{step.icon}</span>
                    <span className="font-heading text-sm font-semibold text-ink">{step.label}</span>
                  </div>
                  {i < JOURNEY_STEPS.length - 1 && (
                    <span className="text-muted" aria-hidden>→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Parent confidence ───────────────────────────────────────────── */}
        <section className="bg-brand-50 py-16">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand">
                  For parents
                </p>
                <h2 className="mb-4 font-heading text-2xl font-bold text-ink md:text-3xl">
                  Progress you can see. Learning you can trust.
                </h2>
                <p className="mb-6 text-muted">
                  Decifer gives you a clear view of what your child is learning,
                  where they&apos;re doing well, and where a little extra support could help.
                  Everything is structured to build confidence, not frustration.
                </p>
                <Link
                  href="/help/parent-guide"
                  className="inline-flex h-10 items-center rounded-lg border border-brand/30 px-5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
                >
                  Read the parent guide →
                </Link>
              </div>
              <ul className="space-y-3">
                {PARENT_POINTS.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 shadow-sm">
                    <span className="mt-0.5 flex-none text-lg" aria-hidden>{point.icon}</span>
                    <div>
                      <p className="font-semibold text-ink">{point.title}</p>
                      <p className="text-sm text-muted">{point.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Sample topics ───────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Explore topics
            </h2>
            <p className="mb-2 text-center text-sm text-muted">
              Covering Year 3 and Year 7 to start, with more subjects and year groups on the way.
            </p>
            <p className="mb-10 text-center text-xs text-muted">
              Example topics shown below — actual availability depends on your year group and content status.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_TOPICS.map((topic, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm">
                  <div className="h-1 w-full" style={{ backgroundColor: topic.color }} aria-hidden />
                  <div className="p-4">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: topic.color }} aria-hidden />
                      <span className="text-xs font-bold uppercase tracking-wide text-muted">{topic.subject}</span>
                    </div>
                    <p className="font-heading font-bold text-ink">{topic.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{topic.yearGroup}</p>
                    <p className="mt-2 text-xs text-muted leading-relaxed">{topic.description}</p>
                    <div className="mt-3 flex gap-1.5 text-xs font-semibold">
                      <span className="rounded-lg bg-maths/10 px-2 py-1 text-maths">Learn</span>
                      <span className="rounded-lg bg-science/10 px-2 py-1 text-science">Practise</span>
                      <span className="rounded-lg bg-lightning/20 px-2 py-1 text-ink">Quiz</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Gamification preview ────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Progress that motivates
            </h2>
            <p className="mb-10 text-center text-sm text-muted">
              Every step forward is recognised. Learning feels good here.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {GAMIFICATION_ITEMS.map((item, i) => (
                <div key={i} className="rounded-2xl border border-black/5 bg-background p-5 text-center">
                  <span className="mb-3 block text-3xl" aria-hidden>{item.icon}</span>
                  <p className="mb-1 font-heading font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Help & guides ───────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Help and guides
            </h2>
            <p className="mb-10 text-center text-sm text-muted">
              Everything you need to get started and make the most of Decifer.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <GuideCard
                icon="👨‍👩‍👧"
                title="Parent guide"
                description="How to set up your child's account, track progress, and support learning."
                href="/help/parent-guide"
                audience="parent"
              />
              <GuideCard
                icon="🎒"
                title="Student guide"
                description="How to use Decifer, earn XP, collect cards, and build streaks."
                href="/help/student-guide"
                audience="student"
              />
              <GuideCard
                icon="< >"
                title="How Decifer works"
                description="The thinking behind the lessons, practice, and quiz structure."
                href="/help/how-decifer-works"
                audience="general"
              />
              <GuideCard
                icon="⭐"
                title="Gamification explained"
                description="XP, badges, streaks, shields, and Discovery Cards — all explained."
                href="/help/gamification"
                audience="student"
              />
              <GuideCard
                icon="✅"
                title="Content quality"
                description="How Decifer checks every question and lesson before it reaches your child."
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

        {/* ── Final CTA ───────────────────────────────────────────────────── */}
        <section className="bg-brand-50 py-16">
          <div className="mx-auto max-w-md px-4 text-center">
            <DeciferMark size="lg" className="mb-6 justify-center" />
            <h2 className="mb-3 font-heading text-2xl font-bold text-ink">
              Ready to start?
            </h2>
            <p className="mb-8 text-muted">
              Join Decifer Learning and take the first step towards real confidence.
              Free to start, no credit card required.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/register"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Start learning →
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

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-black/5 bg-surface py-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between">
            <DeciferMark size="xs" />
            <p className="text-xs text-muted">
              UK National Curriculum. For families.
            </p>
            <nav className="flex gap-4 text-xs text-muted" aria-label="Footer navigation">
              <Link href="/help" className="hover:text-ink">Help</Link>
              <Link href="/help/parent-guide" className="hover:text-ink">Parents</Link>
              <Link href="/help/faq" className="hover:text-ink">FAQ</Link>
              <Link href="/login" className="hover:text-ink">Sign in</Link>
            </nav>
          </div>
        </footer>

      </div>
    </>
  )
}

// ── Static content ──────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { title: 'Learn the idea', body: 'Clear explanations with worked examples at the right level.' },
  { title: 'Practise with guidance', body: 'Guided exercises that build confidence before the quiz.' },
  { title: 'Take a quiz', body: 'Test real understanding, earn XP, and unlock rewards.' },
  { title: 'Build confidence', body: 'Track progress every day, celebrate every milestone.' },
]

const JOURNEY_STEPS = [
  { icon: '🗺️', label: 'Choose a topic' },
  { icon: '📖', label: 'Learn' },
  { icon: '✏️', label: 'Practise' },
  { icon: '⚡', label: 'Quiz' },
  { icon: '🏅', label: 'Earn progress' },
]

const PARENT_POINTS = [
  { icon: '📊', title: 'See progress in real time', body: 'Know exactly which topics your child has covered and how they scored.' },
  { icon: '📚', title: 'Structured by UK National Curriculum', body: 'Every lesson and quiz follows the official curriculum for Year 3 and Year 7.' },
  { icon: '✅', title: 'Quality-checked content', body: 'Every question passes automated verification before your child ever sees it.' },
  { icon: '💪', title: 'Built to build confidence', body: 'No shaming, no punishment. Mistakes are part of learning.' },
]

const SAMPLE_TOPICS = [
  {
    title: 'Multiplication Tables',
    subject: 'Maths',
    yearGroup: 'Year 3',
    color: '#6C9EFF',
    description: 'Build speed and confidence with times tables up to 12×12.',
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
