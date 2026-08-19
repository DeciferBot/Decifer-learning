import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'

// Chrome for the free, no-login Reasoning Check.
//
// Deliberately minimal, for the same reason /skills-check and /games are: a
// child sits in front of this without an account, so there is no sign-in nag and
// no commercial cross-promotion. See components/marketing/MarketingFooter.tsx
// for the fuller note (FTC guidance on separating advertising from children's
// content, and Apple's Kids Category rule on links out without a parental gate).
export default function ReasoningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-black/5">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="inline-flex min-h-[48px] items-center">
            <DeciferLogo size="sm" product="Learning" />
          </Link>
          <Link
            href="/reasoning"
            className="inline-flex min-h-[48px] items-center rounded-xl px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
          >
            Reasoning
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  )
}
