import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'

// Chrome for the public, no-login games catalogue (/games and /games/*).
// Deliberately minimal — no MarketingFooter, no sibling-brand links, no
// persistent sign-in nag. These pages are read and played by children
// without an account, same as Decifer Blitz's public /play and /join pages
// (see components/marketing/MarketingFooter.tsx's own comment on why
// commercial cross-promotion stays off child-facing surfaces — FTC guidance
// on separating advertising from children's content, and Apple's Kids
// Category rule on no links out without a parental gate).
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-black/5">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/">
            <DeciferLogo size="sm" product="Learning" />
          </Link>
        </div>
      </header>
      <main className="px-4 py-6">{children}</main>
    </div>
  )
}
