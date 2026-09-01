import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { TAGLINE } from '@/lib/brand'

// Shared footer for the public, adult-facing marketing surface: homepage,
// pricing, subjects, how it works, curriculum, guides, help, Blitz and legal.
//
// NOT used on child-facing surfaces. The (child) route group, the Blitz game
// screens (/join, /play, /live) and /legal/privacy-for-kids are read by
// children, and the DECIFER family row links to a financial trading product.
// Keeping commercial cross-promotion off child-facing pages is where the FTC's
// guidance on separating advertising from children's content and Apple's Kids
// Category rule (no links out without a parental gate) both land. Apple's rule
// does not bite a PWA, but it would the day this ships natively.
//
// `family={false}` drops the DECIFER row for layouts that also wrap a
// child-facing page — the legal layout does, via /legal/privacy-for-kids.

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/curriculum', label: 'Curriculum' },
  { href: '/subjects', label: 'Subjects' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about', label: 'About' },
  { href: '/guides', label: 'UAE guides' },
  { href: '/blitz', label: 'Blitz' },
  { href: '/games', label: 'Free games' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help', label: 'Help' },
  { href: '/help/faq', label: 'FAQ' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/login', label: 'Sign in' },
]

// Sibling brands. Plain product names only, no promotional copy and no
// referral or tracking parameters: this row states who owns what, which is
// what keeps it ordinary corporate identity rather than a financial promotion.
const SIBLING_PRODUCTS: { href: string; label: string }[] = [
  { href: 'https://decifertrading.com', label: 'Decifer Trading' },
  { href: 'https://decifermarketing.com', label: 'Decifer Marketing' },
]

export function MarketingFooter({ family = true }: { family?: boolean }) {
  return (
    <footer className="border-t border-black/5 bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <DeciferLogo size="xs" product="Learning" />
          <p className="flex items-center gap-2 text-xs text-muted">
            {TAGLINE}
            <Link
              href="/legal/terms"
              className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:text-ink"
            >
              Beta
            </Link>
          </p>
        </div>

        <nav
          className="mt-4 flex flex-wrap justify-center gap-x-4 text-xs text-muted sm:justify-start"
          aria-label="Footer navigation"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="inline-block py-2 hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>

        {family ? (
          <div className="mt-4 border-t border-black/5 pt-4">
            <p className="text-center text-xs text-muted sm:text-left">
              Decifer Learning is part of{' '}
              <a href="https://www.decifer.io" className="font-semibold hover:text-ink">
                DECIFER
              </a>
              , alongside{' '}
              {SIBLING_PRODUCTS.map(({ href, label }, i) => (
                <span key={href}>
                  {i > 0 ? ' and ' : ''}
                  <a href={href} className="font-semibold hover:text-ink">
                    {label}
                  </a>
                </span>
              ))}
              .
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-muted sm:text-left">
          © {new Date().getFullYear()} DECIFER. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
