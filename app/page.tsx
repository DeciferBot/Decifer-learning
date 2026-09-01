import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { RecoveryRedirect } from './RecoveryRedirect'
import { DecipherText } from '@/components/ui/DecipherText'
import { RealAppPreview } from '@/components/homepage/RealAppPreview'
import { Deci } from '@/components/ui/Deci'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import type { ComponentType, SVGProps } from 'react'
import {
  BookOpen, Gamepad, Swords, ArrowRight,
  Check, Shield, MapFold,
} from '@/components/ui/icons'
import { SEO_TITLE } from '@/lib/brand'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

// The homepage asks one question and answers it in one tap.
//
// It used to be eleven sections long: the parent case, learning intelligence,
// the loop, the pipeline, the child/parent split, gamification, sample topics,
// availability, guides, Blitz, and a final call to action, with the only
// button being "register". On a phone that is four screens of reading before
// anything can be done. All of it now lives at /about, in one piece.
//
// What is left: a headline, three doors, and one screen for parents.
//   Learn   → /try    pick a year and a subject, answer five real questions
//   Play    → /games  chess, checkers, Connect 4, crosswords, no sign-up
//   Compete → /blitz  live quiz battles; join with a code, no account
// None of the three needs an account. The account comes after the child has
// seen what it is for.

export const metadata = {
  title: { absolute: SEO_TITLE },
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
        <MarketingNav />

        <main>

        {/* ── Hero: headline + three doors ────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-8 md:pb-16 md:pt-14">
          <div className="text-center">
            {/* Deci is the product's face and, until now, appeared on exactly
                two screens, both behind a sign-in. The one page a stranger
                sees had no face at all. */}
            <Deci mood="happy" size={72} className="mx-auto mb-3" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              UK National Curriculum · Years 1 to 11
            </span>
            <h1 className="mt-4 font-heading text-4xl font-black leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
              Learn. Play.{' '}
              <DecipherText as="span" className="text-brand-700" text="Compete." />
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Real lessons, free games and live quiz battles for Years 1 to 11.
              Parents see exactly where their child stands.
            </p>
          </div>

          {/* Each door is one tap target. On a phone the three stack, with the
              picture on the left so all three fit on the first screen with the
              headline. From md up they sit side by side, picture on top. */}
          <ul className="mt-8 grid gap-3 md:grid-cols-3 md:gap-5">
            {DOORS.map((d) => (
              <li key={d.href}>
                <Link
                  href={d.href}
                  className="group flex min-h-[112px] overflow-hidden rounded-xl border-2 border-black/8 bg-surface shadow-clay transition-[transform,box-shadow] duration-fast ease-out hover:-translate-y-0.5 hover:shadow-clay-lg active:translate-y-[2px] active:shadow-clay-pressed touch-manipulation motion-reduce:transition-none md:flex-col"
                >
                  <div
                    className={`relative flex w-28 flex-none items-center justify-center overflow-hidden md:aspect-[5/3] md:w-full ${d.art}`}
                    aria-hidden
                  >
                    <span className="absolute -left-6 -top-8 h-24 w-24 rounded-full bg-white/20" />
                    <span className="absolute -bottom-10 -right-4 h-28 w-28 rounded-full bg-white/15" />
                    <span className="absolute right-6 top-4 h-3 w-3 rounded-full bg-white/40 md:h-4 md:w-4" />
                    <d.Icon size={44} className="relative drop-shadow-sm transition-transform duration-fast group-hover:scale-110 motion-reduce:transition-none md:h-[72px] md:w-[72px]" />
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-3 p-4 md:items-start md:p-5">
                    <div>
                      <p className="font-heading text-xl font-black text-ink md:text-2xl">{d.label}</p>
                      <p className="mt-0.5 text-sm leading-snug text-muted">{d.body}</p>
                    </div>
                    <ArrowRight size={20} className="flex-none text-muted transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none md:mt-1" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-center text-sm text-muted">
            No account needed for any of these.{' '}
            <Link href="/register" className="font-semibold text-brand-700 underline">
              Setting up for your child?
            </Link>
          </p>
        </section>

        {/* ── For parents ─────────────────────────────────────────────────── */}
        <section className="bg-surface py-14 md:py-16">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-700">For parents</p>
              <h2 className="mt-2 font-heading text-2xl font-bold text-ink md:text-3xl">
                Know exactly where your child stands.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">
                A learning map, not just a score. What the curriculum covers, what your child has done, where they are strong, and what to do next. Updated after every session.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="flex h-12 items-center justify-center rounded-xl bg-brand-600 px-7 font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  Set up my child
                </Link>
                <Link
                  href="/how-it-works"
                  className="flex h-12 items-center justify-center rounded-xl border border-black/10 bg-background px-7 font-semibold text-ink transition-colors hover:bg-black/5"
                >
                  How it works
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted">Set-up takes a minute. No credit card.</p>
            </div>
            <RealAppPreview />
          </div>
        </section>

        {/* ── About, in brief ─────────────────────────────────────────────── */}
        <section className="py-14 md:py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center font-heading text-2xl font-bold text-ink md:text-3xl">
              What Decifer is
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {ABOUT_POINTS.map((p) => (
                <div key={p.title} className="rounded-xl border-2 border-black/8 bg-surface p-5 shadow-clay-sm">
                  <p.Icon size={24} className="text-brand-700" aria-hidden />
                  <p className="mt-3 font-heading font-bold text-ink">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link
                href="/about"
                className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl px-4 font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                More about Decifer <ArrowRight size={16} aria-hidden />
              </Link>
            </p>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────────── */}
        <section className="bg-brand-50 py-14">
          <div className="mx-auto max-w-md px-4 text-center">
            <h2 className="font-heading text-2xl font-bold text-ink">Ready when you are.</h2>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/register"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Set up my child
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

        <MarketingFooter />
      </div>
    </>
  )
}

// ── Static content ─────────────────────────────────────────────────────────────

// The purple is Blitz's own colour and matches the Blitz button in MarketingNav.
// The three panels use the product's own colours, not the subject colours.
// They used to be maths blue, science green and a raw purple (#7C3AED) that
// exists nowhere else in Decifer. Painting a page that has no subjects on it
// with subject colours is what made the marketing pages feel like a different
// product from the app.
const DOORS: Array<{ href: string; label: string; body: string; Icon: Icon; art: string }> = [
  {
    href: '/try',
    label: 'Learn',
    body: 'Pick your year and a subject. Five real questions, right now.',
    Icon: BookOpen,
    art: 'bg-sea text-white',
  },
  {
    href: '/games',
    label: 'Play',
    body: 'Chess, checkers, Connect 4, crosswords. Free, no sign-up.',
    Icon: Gamepad,
    art: 'bg-teal text-white',
  },
  {
    href: '/blitz',
    label: 'Compete',
    body: 'Live quiz battles with friends or the class. Join with a code.',
    Icon: Swords,
    art: 'bg-ember text-white',
  },
]

const ABOUT_POINTS: Array<{ Icon: Icon; title: string; body: string }> = [
  {
    Icon: Check,
    title: 'The UK curriculum, Years 1 to 11',
    body: 'Maths, English, Science, History and Geography. Every topic mapped to what school teaches.',
  },
  {
    Icon: Shield,
    title: 'Checked before your child sees it',
    body: 'Every question passes six automated checks. Anything below the bar is not published.',
  },
  {
    Icon: MapFold,
    title: 'Built for children, clear for parents',
    body: 'Children get points, cards and streaks. Parents get a learning map that shows what to do next.',
  },
]
