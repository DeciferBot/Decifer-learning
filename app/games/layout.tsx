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
    <div className="relative min-h-screen bg-background">
      {/* A warm pool of light behind the content, so the games section reads
          as a room you have walked into rather than another page of the site.
          Purely decorative and behind everything, hence pointer-events-none. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(70% 100% at 50% 0%, rgb(var(--tw-ember) / 0.10) 0%, rgb(var(--tw-ember) / 0.03) 45%, transparent 100%)',
        }}
      />
      <header className="relative border-b border-black/5">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="inline-flex min-h-[48px] items-center">
            <DeciferLogo size="sm" product="Learning" />
          </Link>
          <Link
            href="/games"
            className="inline-flex min-h-[48px] items-center rounded-xl px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
          >
            All games
          </Link>
        </div>
      </header>
      <main className="relative mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
