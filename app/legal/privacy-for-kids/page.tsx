import type { Metadata } from 'next'
import Link from 'next/link'
import { Lock, Check } from '@/components/ui/icons'

export const metadata: Metadata = {
  title: 'Your Privacy — Decifer Learning',
  description: 'What Decifer Learning knows about you, and how we keep it safe.',
}

// Child-friendly privacy notice — required by UK Children's Code (Standard 4).
// Written at approximately Year 3 reading level. No legal jargon.

export default function PrivacyForKidsPage() {
  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <Link
        href="/dashboard/child"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        ← Back to home
      </Link>

      <h1 className="font-heading text-2xl font-bold text-ink flex items-center gap-2">
        <Lock className="w-6 h-6" aria-hidden /> Your Privacy on Decifer Learning
      </h1>
      <p className="mt-1 text-sm text-muted">Written for you — not just for grown-ups!</p>

      <div className="mt-6 space-y-5">
        <Section title="What do we know about you?">
          <p>When you use Decifer Learning, we save:</p>
          <ul className="mt-2 space-y-1 text-sm">
            <Item>Your display name (the name you chose)</Item>
            <Item>Your year group (Year 3 or Year 7)</Item>
            <Item>Your quiz scores and which topics you&apos;ve practised</Item>
            <Item>Your Discovery Cards and badges</Item>
            <Item>Your avatar, theme colour, and study buddy choice</Item>
          </ul>
          <p className="mt-2 text-sm text-muted">
            We <strong>never</strong> ask for your real name, home address, phone number,
            or photograph.
          </p>
        </Section>

        <Section title="Why do we save this?">
          <p>
            We save your progress so the app remembers where you left off and can show
            you questions that match what you&apos;re learning. Your parent can see your
            progress too — that&apos;s how they know how you&apos;re getting on.
          </p>
        </Section>

        <Section title="Who can see your information?">
          <ul className="mt-2 space-y-1 text-sm">
            <Item>You can see your own scores, cards, and badges</Item>
            <Item>Your parent or carer can see your progress and quiz results</Item>
            <Item>Nobody else — we don&apos;t share your information with other companies</Item>
          </ul>
        </Section>

        <Section title="Do we track you around the internet?">
          <p>
            No. Decifer Learning doesn&apos;t follow you around the internet or show
            you adverts. We only use Vercel Analytics — a simple counter that tells us
            how many people visited the app today. It doesn&apos;t know who you are.
          </p>
        </Section>

        <Section title="Can you delete your information?">
          <p>
            Yes! Ask a parent or carer to contact us at{' '}
            <a href="mailto:hello@deciferlearning.com" className="text-maths underline">
              hello@deciferlearning.com
            </a>{' '}
            and we&apos;ll delete everything about you.
          </p>
        </Section>

        <Section title="What if something feels wrong?">
          <p>
            Tell a trusted adult — a parent, carer, or teacher. You can also visit{' '}
            <a
              href="https://www.childline.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-maths underline"
            >
              Childline
            </a>{' '}
            if you have worries about anything online.
          </p>
        </Section>

        <div className="rounded-xl border border-black/5 bg-surface px-4 py-3">
          <p className="text-xs text-muted">
            Parents: the full legal privacy policy is at{' '}
            <Link href="/legal/privacy" className="underline">
              /legal/privacy
            </Link>
            . For our Children&apos;s Code compliance audit, see{' '}
            <span className="font-mono text-xs">docs/CHILDRENS_CODE_COMPLIANCE.md</span>{' '}
            in our repository.
          </p>
        </div>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4">
      <h2 className="mb-2 font-heading text-base font-bold text-ink">{title}</h2>
      <div className="text-sm text-ink leading-relaxed">{children}</div>
    </div>
  )
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 w-4 h-4 flex-none text-correct" aria-hidden />
      <span>{children}</span>
    </li>
  )
}
