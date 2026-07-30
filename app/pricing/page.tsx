import type { Metadata } from 'next'
import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'

export const metadata: Metadata = {
  // Bare "Pricing" ranks for nothing. Name the product, the offer and the market.
  title: 'Pricing: Free While in Beta | UK Curriculum Learning App for UAE Families',
  description:
    'Decifer Learning is completely free while in beta. All five subjects, every year group from Year 1 to Year 11, the parent dashboard and every feature. No card required.',
  alternates: { canonical: '/pricing' },
}

const INCLUDED = [
  'All five subjects: Maths, English, Science, History and Geography',
  'Every year group, Year 1 to Year 11 (KS1 to GCSE)',
  'Unlimited topics, quizzes and practice',
  'Hints, lives, streaks, badges and Discovery Cards',
  'Parent dashboard with a learning map of strengths and weak areas',
  'Screen-time controls',
  'Spaced-repetition review scheduling',
  'Daily Mystery Challenge',
  'Works on iPad and phone, installable from Safari',
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/">
            <DeciferLogo size="sm" product="Learning" />
          </Link>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <Link
              href="/login"
              className="flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ink hover:bg-black/5"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">
            Beta
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold text-ink">
            Free while we are in beta
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
            Every subject, every year group, every feature. No card, no trial clock, no locked
            topics.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-lg rounded-2xl border-2 border-brand bg-surface p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Everything included
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-bold text-ink">AED 0</span>
            <span className="text-muted">during beta</span>
          </div>
          <ul className="mt-6 space-y-3">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink">
                <span className="mt-0.5 text-correct">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/register"
            className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Create a free account
          </Link>
          <p className="mt-3 text-center text-xs text-muted">
            Takes about two minutes. No payment details asked for, ever, during beta.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="font-heading text-2xl font-bold text-ink">Why is it free?</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-muted">
            <p>
              We are in beta. The best way for us to build a genuinely good learning app is to have
              real children using it every day and telling us what works. Charging families during
              that period would be premature, so we do not.
            </p>
            <p>
              When the beta ends we may introduce paid plans. If that happens, we will tell you
              well in advance, nothing will be charged without you actively choosing a plan, and
              your child&apos;s progress, streaks and card collection stay intact either way.
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="font-heading text-2xl font-bold text-ink">Common questions</h2>
          <div className="mt-6 divide-y divide-black/5">
            {[
              {
                q: 'Is it really all free?',
                a: 'Yes. During beta there is one tier and it includes everything: all five subjects, Years 1 to 11, unlimited quizzes, and the full parent dashboard. There is no payment step anywhere in the product.',
              },
              {
                q: 'Will I be charged when the beta ends?',
                a: 'No, not automatically. We never hold your card details during beta, so there is nothing to charge. If paid plans arrive later, you would have to actively choose one.',
              },
              {
                q: 'What year groups are covered?',
                a: 'Year 1 through Year 11: KS1, KS2, KS3, and KS4 (GCSE). Year 10 and 11 content is aligned to AQA and Edexcel.',
              },
              {
                q: 'Is the content aligned to the UK National Curriculum?',
                a: 'Yes. All content is written against the England National Curriculum and passes a six-stage quality pipeline including code verification and independent consensus checks.',
              },
              {
                q: 'Is it safe for my child to use?',
                a: "Child accounts have no social features and no advertising. Content is checked for age-appropriateness at every stage. We comply with the UK Children's Code.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="py-5">
                <p className="font-semibold text-ink">{q}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-black/5 py-8 text-center text-xs text-muted">
        <div className="space-x-4">
          <Link href="/legal/terms" className="hover:underline">Terms</Link>
          <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
          <Link href="/help" className="hover:underline">Help</Link>
          <Link href="/guides" className="hover:underline">UAE parent guides</Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} DECIFER. All rights reserved.</p>
      </footer>
    </div>
  )
}
