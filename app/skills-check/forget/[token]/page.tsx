import type { Metadata } from 'next'
import Link from 'next/link'
import { deleteLead } from '@/lib/skills-check/server'
import { ForgetButton } from './ForgetButton'

// The one-click delete link from the report email.
//
// It does NOT delete on page load. A link in an email gets fetched by scanners,
// previewers and prefetchers, and a destructive GET would mean some parents lose
// their report to a mail client that was only being helpful. So the page asks,
// and the button does it.
//
// The result is reported honestly: if there was nothing to delete, it says so
// rather than claiming a deletion that did not happen.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Delete your Skills Check report',
  robots: { index: false, follow: false },
}

async function forget(token: string): Promise<boolean> {
  'use server'
  return deleteLead(token)
}

export default function ForgetPage({ params }: { params: { token: string } }) {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-ink">Delete your email and this report</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          This removes your email address from our records and stops any further emails about
          this check. We never held anything that identifies your child, so there is nothing else
          to remove.
        </p>
      </header>

      <ForgetButton token={params.token} action={forget} />

      <nav className="border-t border-black/5 pt-5">
        <Link
          href="/skills-check"
          className="inline-flex min-h-[48px] items-center text-sm font-semibold text-ember hover:underline"
        >
          Back to the Skills Check
        </Link>
      </nav>
    </div>
  )
}
