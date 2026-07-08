import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { RecoveryRedirect } from './RecoveryRedirect'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { DecipherText } from '@/components/ui/DecipherText'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'
import { GuideCard } from '@/components/ui/GuideCard'
import { LearningJourney } from '@/components/homepage/LearningJourney'
import { QualityPipeline } from '@/components/homepage/QualityPipeline'
import { HeroMockup } from '@/components/homepage/HeroMockup'
import type { ComponentType, SVGProps } from 'react'
import {
  MapFold, Check, BarChart, Users,
  TrendingUp, Search, MapPin, Link2,
  BookOpen, PencilLine, Zap, Star,
  Trophy, Flame, Medal, Gem,
  ClipboardList, Telescope, Target, CircleCheck, Bell,
  Backpack, GraduationCap, Shield,
} from '@/components/ui/icons'
import { TAGLINE, TITLE } from '@/lib/brand'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export const metadata = {
  title: { absolute: TITLE },
  description:
    'Decifer gives parents a clear picture of their child\'s learning: what the UK National Curriculum covers, what they know, and what to do next. Years 1 to 11.',
  alternates: { canonical: '/' },
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
              <DarkModeToggle />
              <Link
                href="/play"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] sm:px-4"
              >
                <Zap size={15} aria-hidden />
                Blitz
              </Link>
              <Link
                href="/login"
                className="flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-black/5 sm:px-4"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="flex h-9 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:px-4"
              >
                Get started
              </Link>
            </div>
          </div>
        </nav>

        <main>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 py-12 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">

            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                UK National Curriculum · Years 1 to 11
              </span>

              <h1 className="mt-4 font-heading text-3xl font-black leading-tight text-ink sm:text-4xl lg:text-5xl">
                See your child build confidence,{' '}
                <DecipherText as="span" className="text-brand" text="one topic at a time." />
              </h1>

              <p className="mt-4 text-base leading-relaxed text-muted">
                Decifer gives parents a clear picture of their child&apos;s learning. What the curriculum covers. What they have done. Where they are strong. What to do next.
              </p>

              <p className="mt-3 text-sm leading-relaxed text-muted">
                Decifer works alongside school and is built for parents as much as children, so you can see exactly where yours stands.
              </p>

              {/* Trust chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                {TRUST_CHIPS.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    <chip.Icon size={14} aria-hidden />
                    {chip.label}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="flex h-12 items-center justify-center rounded-xl bg-brand-600 px-7 font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  See your child&apos;s learning map
                </Link>
                <Link
                  href="/how-it-works"
                  className="flex h-12 items-center justify-center rounded-xl border border-black/10 bg-surface px-7 font-semibold text-ink transition-colors hover:bg-black/5"
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

        {/* ── Parent problem ───────────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Most tools are built for children.<br className="hidden sm:block" /> Very few are built for the parent who wants to understand what is happening.
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-center text-sm text-muted">
              A score tells you what happened. Decifer tells you what it means.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PARENT_PROBLEM_CARDS.map((card, i) => (
                <div key={i} className="rounded-2xl border border-black/5 bg-background p-5 shadow-sm">
                  <card.Icon size={24} className="mb-3 text-muted" aria-hidden />
                  <p className="font-heading font-semibold text-ink">{card.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Learning Intelligence ─────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-brand-600">
              Learning intelligence
            </p>
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Patterns based on what your child actually does.
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-center text-sm text-muted">
              Decifer looks at quiz answers, lesson behaviour, and topic progress to surface patterns a score alone cannot show. Every insight shows the evidence behind it.
            </p>

            <div className="grid gap-5 md:grid-cols-3">
              {LEARNING_INTELLIGENCE_CARDS.map((card, i) => (
                <div key={i} className="rounded-2xl border border-brand/10 bg-brand-50 p-6">
                  <card.Icon size={24} className="mb-3 text-brand" aria-hidden />
                  <p className="mb-1 font-heading font-bold text-ink">{card.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{card.body}</p>
                  {card.example && (
                    <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-ink">Example: </span>{card.example}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-black/5 bg-surface px-6 py-4 text-center">
              <p className="text-xs text-muted">
                Patterns are based on your child&apos;s activity in Decifer. They may suggest a direction. They do not diagnose or predict. Every insight shows how many data points it is based on.
              </p>
            </div>
          </div>
        </section>

        {/* ── The learning loop ────────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-brand-600">
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
                I tried. I improved. I can see progress. I want to continue.
              </p>
              <p className="mt-1 text-xs text-muted">
                That loop is what Decifer is built to create. Parents can see every step of it in the learning map.
              </p>
            </div>
          </div>
        </section>

        {/* ── Content quality pipeline ─────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-brand-600">
              Content quality
            </p>
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Quality checked. Before your child sees it.
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-center text-sm text-muted">
              Every question and lesson passes a six-stage process before it is published. Content that does not meet the threshold is blocked, not published.
            </p>

            <QualityPipeline />
          </div>
        </section>

        {/* ── Child / Parent split ─────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Built for children. A clear picture for parents.
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-center text-sm text-muted">
              Children feel progress. Parents see the learning behind it.
            </p>
            <div className="grid gap-5 md:grid-cols-2">

              {/* Child column */}
              <div className="rounded-2xl border border-maths/20 bg-maths/5 p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-ink">
                  For children
                </p>
                <h3 className="mb-4 font-heading text-lg font-bold text-ink">
                  A clear, friendly learning experience.
                </h3>
                <ul className="space-y-4">
                  {CHILD_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <f.Icon size={18} className="mt-0.5 flex-none text-maths" aria-hidden />
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
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-600">
                  For parents
                </p>
                <h3 className="mb-2 font-heading text-lg font-bold text-ink">
                  A learning map, not just a grade.
                </h3>
                <p className="mb-4 text-xs leading-relaxed text-muted">
                  The learning map shows what your child has covered, what is going well, where more practice would help, and what to do next. All based on their actual activity in Decifer.
                </p>
                <ul className="space-y-4">
                  {PARENT_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <f.Icon size={18} className="mt-0.5 flex-none text-brand" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-ink">{f.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{f.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/help/parent-guide"
                  className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-brand-600/40 px-5 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50"
                >
                  Read the parent guide <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Game-like motivation ─────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Winning happens every day, not just on results day.
            </h2>
            <p className="mb-2 text-center text-sm text-muted">
              Most learning feels like something that happens to you. Decifer makes it something worth coming back to.
            </p>
            <p className="mb-10 text-center text-xs text-muted">
              Every correct answer earns points. Every topic completed is a win. Leaderboards, streaks, and Discovery Cards are earned only through real learning activity. Children cannot buy them, and we never use them to apply pressure.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {GAMIFICATION_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-black/5 bg-surface p-5 text-center shadow-sm"
                >
                  <item.Icon size={32} className="mb-3 mx-auto text-muted" aria-hidden />
                  <p className="mb-1 font-heading font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Topic preview ────────────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Example topics
            </h2>
            <p className="mb-2 text-center text-sm text-muted">
              Years 1 to 11. Maths, English, Science, History, and Geography.
            </p>
            <p className="mb-10 text-center text-xs text-muted">
              Each topic includes a guided lesson, practice exercises, and a quiz. Your child sees only verified, published content.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_TOPICS.map((topic, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-black/5 bg-background shadow-sm"
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
                      <span className="rounded-lg bg-maths/10 px-2 py-1.5 text-ink">Learn</span>
                      <span className="rounded-lg bg-science/10 px-2 py-1.5 text-ink">Practise</span>
                      <span className="rounded-lg bg-lightning/20 px-2 py-1.5 text-ink">Quiz</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link
                href="/register"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 font-semibold text-white transition-colors hover:bg-brand-700"
              >
                See your child&apos;s learning map
              </Link>
            </p>
          </div>
        </section>

        {/* ── Content availability ────────────────────────────────────────── */}
        <section className="py-14">
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-2xl border border-black/5 bg-surface p-6 text-center shadow-sm md:p-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
                What is available today
              </p>
              <h2 className="mb-4 font-heading text-xl font-bold text-ink md:text-2xl">
                Five subjects. 300+ topics. Years 1 to 11.
              </h2>
              <p className="mx-auto mb-6 max-w-lg text-sm leading-relaxed text-muted">
                Maths, English and Science run all the way from Year 1 to GCSE (Year 11). History and Geography cover Year 1 to Year 9. Every one of our 6,900+ questions has passed the six-stage quality process, so your child only ever sees content that is verified and ready.
              </p>
              <div className="flex flex-wrap justify-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-maths/10 px-4 py-1.5 font-semibold text-ink">
                  <Check className="w-4 h-4" aria-hidden /> Maths: Years 1 to 11
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-english/10 px-4 py-1.5 font-semibold text-ink">
                  <Check className="w-4 h-4" aria-hidden /> English: Years 1 to 11
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-science/10 px-4 py-1.5 font-semibold text-ink">
                  <Check className="w-4 h-4" aria-hidden /> Science: Years 1 to 11
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-surface border border-gray-200 px-4 py-1.5 font-semibold text-ink">
                  <Check className="w-4 h-4" aria-hidden /> History: Years 1 to 9
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-surface border border-gray-200 px-4 py-1.5 font-semibold text-ink">
                  <Check className="w-4 h-4" aria-hidden /> Geography: Years 1 to 9
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Help and guides ──────────────────────────────────────────────── */}
        <section className="bg-surface py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              Help and guides
            </h2>
            <p className="mb-10 text-center text-sm text-muted">
              Everything you need to get started and make the most of Decifer Learning.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <GuideCard
                icon={<Users size={22} />}
                title="Parent guide"
                description="How to set up your child's account, read the learning map, and support their learning."
                href="/help/parent-guide"
                audience="parent"
              />
              <GuideCard
                icon={<Backpack size={22} />}
                title="Student guide"
                description="How to use Decifer Learning, earn XP, collect cards, and keep your streak going."
                href="/help/student-guide"
                audience="student"
              />
              <GuideCard
                icon={<BookOpen size={22} />}
                title="How Decifer Learning works"
                description="The thinking behind the lessons, practice, quiz structure, and learning map."
                href="/help/how-decifer-works"
                audience="general"
              />
              <GuideCard
                icon={<Trophy size={22} />}
                title="Gamification explained"
                description="XP, badges, streaks, shields, and Discovery Cards, all explained."
                href="/help/gamification"
                audience="student"
              />
              <GuideCard
                icon={<CircleCheck size={22} />}
                title="Content quality"
                description="How Decifer Learning checks every question and lesson before it reaches your child."
                href="/help/content-quality"
                audience="parent"
              />
              <GuideCard
                icon={<Bell size={22} />}
                title="Frequently asked questions"
                description="Answers to the most common questions from parents and students."
                href="/help/faq"
                audience="general"
              />
            </div>
          </div>
        </section>

        {/* ── Decifer Blitz ────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <div className="overflow-hidden rounded-3xl border border-black/5 bg-ink px-6 py-10 text-center sm:px-12 sm:py-12">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/10 px-3 py-1 text-xs font-semibold text-white">
                <Zap size={14} aria-hidden /> Decifer Blitz
              </span>
              <h2 className="mx-auto mt-4 max-w-2xl font-heading text-2xl font-bold text-white md:text-3xl">
                Live quiz battles for the classroom and the kitchen table.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70">
                Host a real-time quiz in 30 seconds. Players join from any device with a code, no account needed. UK curriculum questions, checked answers, instant leaderboard.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/play"
                  className="flex h-12 items-center justify-center rounded-xl bg-brand-600 px-7 font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  Host a game
                </Link>
                <Link
                  href="/blitz"
                  className="flex h-12 items-center justify-center rounded-xl border border-white/20 bg-surface/5 px-7 font-semibold text-white transition-colors hover:bg-surface/10"
                >
                  How Blitz works
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="bg-brand-50 py-16">
          <div className="mx-auto max-w-md px-4 text-center">
            <DeciferLogo size="lg" product="Learning" className="mb-6 justify-center" />
            <h2 className="mb-3 font-heading text-2xl font-bold text-ink">
              Your child learns. You know exactly where they stand.
            </h2>
            <p className="mb-8 text-sm text-muted">
              No credit card required. Set up takes two minutes. Your child can start their first topic today and you will have a learning map from the first session.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/register"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white transition-colors hover:bg-brand-700"
              >
                See your child&apos;s learning map
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

        </main>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t border-black/5 bg-surface py-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between">
            <DeciferLogo size="xs" product="Learning" />
            <p className="text-xs text-muted">{TAGLINE}</p>
            <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted sm:justify-start" aria-label="Footer navigation">
              <Link href="/curriculum" className="hover:text-ink">Curriculum</Link>
              <Link href="/subjects" className="hover:text-ink">Subjects</Link>
              <Link href="/how-it-works" className="hover:text-ink">How it works</Link>
              <Link href="/blitz" className="hover:text-ink">Blitz</Link>
              <Link href="/pricing" className="hover:text-ink">Pricing</Link>
              <Link href="/help" className="hover:text-ink">Help</Link>
              <Link href="/help/faq" className="hover:text-ink">FAQ</Link>
              <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
              <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
              <Link href="/login" className="hover:text-ink">Sign in</Link>
              <a href="https://www.decifer.io" className="hover:text-ink">Part of DECIFER</a>
              <a href="https://decifertrading.com" className="hover:text-ink">Decifer Trading</a>
              <a href="https://decifermarketing.com" className="hover:text-ink">Decifer Marketing</a>
            </nav>
          </div>
        </footer>

      </div>
    </>
  )
}

// ── Static content ─────────────────────────────────────────────────────────────

const TRUST_CHIPS: Array<{ Icon: Icon; label: string }> = [
  { Icon: MapFold,       label: 'Learning map for parents' },
  { Icon: Shield,        label: 'Six-stage quality pipeline' },
  { Icon: GraduationCap, label: 'UK curriculum, Years 1 to 11' },
  { Icon: Check,         label: 'No advertising. No pressure.' },
]

const PARENT_PROBLEM_CARDS: Array<{ Icon: Icon; title: string; body: string }> = [
  {
    Icon: BarChart,
    title: 'You get a score. You do not know what it means.',
    body: 'An 80% after three hints is very different from an 80% on the first attempt. Decifer shows you both.',
  },
  {
    Icon: ClipboardList,
    title: 'You are asked to help. Nobody tells you what they are supposed to learn.',
    body: 'Most parents do not know what Year 5 Maths covers. Decifer shows you the curriculum alongside your child\'s progress.',
  },
  {
    Icon: Target,
    title: 'Your child has homework on multiple apps. None of them give you the full picture.',
    body: 'Decifer brings it into one place and tells you what your child actually understands, not just what they submitted.',
  },
  {
    Icon: Telescope,
    title: 'Most parents find out their child is struggling at parents evening. By then, months have passed.',
    body: 'Decifer gives you the same picture their teacher has. Updated after every session.',
  },
]

const LEARNING_INTELLIGENCE_CARDS: Array<{ Icon: Icon; title: string; body: string; example?: string }> = [
  {
    Icon: MapFold,
    title: 'Progress by subject',
    body: 'See which topics your child has started, completed, and revisited across all five subjects. Based on their actual topic progress and quiz attempts.',
    example: '"Completed 6 of 14 Maths topics. Last active 2 days ago."',
  },
  {
    Icon: TrendingUp,
    title: 'Where they are strong',
    body: 'Topics where your child scored well and completed more than once show up here, with the score and how many times they have revisited.',
    example: '"Completed with 85% on the last attempt. Reviewed twice."',
  },
  {
    Icon: Search,
    title: 'Where more practice would help',
    body: 'Topics with lower accuracy across multiple attempts, or where hints were used frequently, are highlighted with the evidence behind them.',
    example: '"Lower accuracy across 12 answers. Hints used in 7 of those."',
  },
]

const CHILD_FEATURES: Array<{ Icon: Icon; title: string; body: string }> = [
  { Icon: BookOpen,   title: 'Guided lessons at the right level',  body: 'Explanations and examples matched to the UK curriculum for their year group.' },
  { Icon: PencilLine, title: 'Practice with hints and retries',    body: 'Exercises with up to three hint levels. Retrying is always allowed and never penalised.' },
  { Icon: Zap,        title: 'Quizzes with instant feedback',      body: 'Ten questions per topic. Correct answers are celebrated. Mistakes are explained.' },
  { Icon: Star,       title: 'XP, badges, and Discovery Cards',    body: 'Progress is rewarded. Cards, streaks, and badges keep learning feeling worthwhile.' },
]

const PARENT_FEATURES: Array<{ Icon: Icon; title: string; body: string }> = [
  { Icon: MapFold, title: 'The learning map',            body: 'A clear view of what your child has covered, what is going well, and where more practice would help. Based on their actual activity.' },
  { Icon: Search,  title: 'Learning patterns over time', body: 'Patterns based on quiz answers, lesson behaviour, and topic progress. Each pattern shows the evidence it is based on.' },
  { Icon: MapPin,  title: 'A suggested next step',       body: 'Every insight includes a practical next step. Something specific you or your child can do, not a vague recommendation.' },
  { Icon: Link2,   title: 'Linked from your account',    body: 'Create your account, link your child, and see their learning map straight away. No setup beyond the basics.' },
]

const SAMPLE_TOPICS = [
  {
    title: 'Place Value',
    subject: 'Maths',
    yearGroup: 'Year 2',
    color: '#6C9EFF',
    description: 'Understand tens and ones, compare and order two-digit numbers.',
  },
  {
    title: 'Multiplication Tables',
    subject: 'Maths',
    yearGroup: 'Year 3',
    color: '#6C9EFF',
    description: 'Build speed and confidence with times tables up to 12 x 12.',
  },
  {
    title: 'Persuasive Writing',
    subject: 'English',
    yearGroup: 'Year 6',
    color: '#FF8FAB',
    description: 'Structure arguments, use evidence, and write to convince.',
  },
  {
    title: 'Cells and Organisation',
    subject: 'Science',
    yearGroup: 'Year 7',
    color: '#52D9A0',
    description: 'Explore the building blocks of life and how organisms are structured.',
  },
]

const GAMIFICATION_ITEMS: Array<{ Icon: Icon; label: string; desc: string }> = [
  { Icon: Star,  label: 'XP Points',      desc: 'Every correct answer earns points. Every quiz completed adds to the total.' },
  { Icon: Flame, label: 'Streaks',         desc: 'Come back each day and the streak grows. A Streak Shield absorbs a missed day.' },
  { Icon: Medal, label: 'Badges',          desc: 'Earned for real achievements. Perfect scores, topic mastery, and seven-day streaks.' },
  { Icon: Gem,   label: 'Discovery Cards', desc: 'Five rarities. Collected after every passed quiz. Displayed in your child\'s album.' },
]
