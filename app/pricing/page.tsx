import type { Metadata } from 'next'
import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { UpgradeButton } from '@/components/ui/UpgradeButton'

export const metadata: Metadata = {
  title: 'Pricing — DECIFER Learning',
  description:
    'Start free with 3 Maths topics. Upgrade to Family for unlimited access across Maths, English and Science.',
}

const FREE_FEATURES = [
  '3 Maths topics — free forever',
  'Full quiz engine with hints and lives',
  'Discovery Cards and badges',
  'Progress tracking',
]

const FAMILY_FEATURES = [
  'All subjects: Maths, English, Science',
  'All year groups — Year 1 to Year 11',
  'Unlimited topics and quizzes',
  'Parent dashboard with weak-area insights',
  'Screen-time controls',
  'Spaced-repetition review scheduling',
  'Daily Mystery Challenge',
  'Reward Vault milestones',
  'Priority content updates',
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <DeciferLogo size="sm" product="Learning" />
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="h-9 rounded-lg px-3 text-sm font-semibold text-ink hover:bg-black/5"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-ink">Simple, honest pricing</h1>
          <p className="mt-3 text-lg text-muted">
            Start free. Upgrade when you need all three subjects.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {/* Free plan */}
          <div className="rounded-2xl border border-black/10 bg-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Free</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-bold text-ink">£0</span>
              <span className="text-muted">forever</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              No card required. Covers 3 Maths topics for one child.
            </p>
            <ul className="mt-6 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink">
                  <span className="mt-0.5 text-correct">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-8 flex h-11 items-center justify-center rounded-xl border border-black/15 bg-white text-sm font-semibold text-ink transition hover:bg-black/5"
            >
              Get started free
            </Link>
          </div>

          {/* Family plan */}
          <div className="relative rounded-2xl border-2 border-maths bg-surface p-6">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-maths px-3 py-0.5 text-xs font-bold text-white">
              Most popular
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-maths">Family</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-bold text-ink">£7.99</span>
              <span className="text-muted">/month</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              One subscription covers your whole family — unlimited children.
            </p>
            <ul className="mt-6 space-y-3">
              {FAMILY_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink">
                  <span className="mt-0.5 text-maths">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <UpgradeButton />
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              Cancel anytime. Secure checkout via Stripe.
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="font-heading text-2xl font-bold text-ink">Common questions</h2>
          <div className="mt-6 divide-y divide-black/5">
            {[
              {
                q: 'How many children can use one Family subscription?',
                a: 'Unlimited. Link as many child accounts as you have — no extra charge.',
              },
              {
                q: 'What year groups are covered?',
                a: 'Year 1 through Year 11 — KS1, KS2, KS3, and KS4 (GCSE). Year 10 and 11 content is aligned to AQA and Edexcel.',
              },
              {
                q: 'What happens to my data if I cancel?',
                a: 'Your account and progress stay intact. You drop back to the free tier (3 Maths topics). You can request full data deletion any time via our privacy settings.',
              },
              {
                q: 'Is the content aligned to the UK National Curriculum?',
                a: 'Yes. All content is written against the England National Curriculum and passes a six-stage quality pipeline including code verification and independent consensus checks.',
              },
              {
                q: 'Is it safe for my child to use?',
                a: 'Child accounts have no social features and no advertising. Content is checked for age-appropriateness at every stage. We comply with the UK Children\'s Code.',
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
        </div>
        <p className="mt-2">© {new Date().getFullYear()} DECIFER. All rights reserved.</p>
      </footer>
    </div>
  )
}
