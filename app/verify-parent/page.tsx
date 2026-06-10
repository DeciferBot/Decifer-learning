// /verify-parent?token=<uuid>
// Landing page for the parent/guardian verification email. Public route.
// The actual confirmation is a server-action POST behind a button so that
// email link scanners (which prefetch GETs) can never auto-verify.

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Confirm your child’s account — Decifer Learning' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function confirmConsent(formData: FormData) {
  'use server'
  const token = String(formData.get('token') ?? '')
  if (!UUID_RE.test(token)) redirect('/verify-parent')

  const profile = await prisma.profile.findUnique({
    where: { parent_verify_token: token },
    select: { id: true, parent_email_verified_at: true, parental_consent_at: true },
  })
  if (profile && !profile.parent_email_verified_at) {
    // Clear the token so a forwarded/old link can never re-open a page that
    // shows the child's name — the link is strictly single-use.
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        parent_email_verified_at: new Date(),
        parent_verify_token: null,
        // Verified confirmation doubles as consent if signup didn't record it
        // (e.g. the parent email was added later via the in-app banner).
        ...(profile.parental_consent_at ? {} : { parental_consent_at: new Date() }),
      },
    })
  }
  redirect('/verify-parent?done=1')
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <p className="text-lg font-bold">
          <span style={{ color: '#F05A28' }}>DECIFER</span>{' '}
          <span className="text-ink">Learning</span>
        </p>
        {children}
      </div>
    </main>
  )
}

export default async function VerifyParentPage({
  searchParams,
}: {
  searchParams: { token?: string; done?: string }
}) {
  const token = searchParams.token ?? ''

  // Post-confirmation landing — deliberately generic, no child data on screen.
  if (searchParams.done) {
    return (
      <Shell>
        <h1 className="mt-4 font-heading text-xl font-bold text-ink">All confirmed ✓</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Thank you — we&apos;ve recorded your confirmation.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Want to follow your child&apos;s progress, set screen-time limits, and get weekly
          updates? Create a free parent account with this email address, then link your child
          from the parent dashboard.
        </p>
        <Link
          href="/register"
          className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white"
        >
          Create a parent account
        </Link>
      </Shell>
    )
  }

  if (!UUID_RE.test(token)) {
    return (
      <Shell>
        <h1 className="mt-4 font-heading text-xl font-bold text-ink">This link isn’t valid</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The confirmation link is missing or incomplete. Please open the most recent email from
          Decifer Learning and tap the button again, or copy the full link into your browser.
        </p>
      </Shell>
    )
  }

  const profile = await prisma.profile.findUnique({
    where: { parent_verify_token: token },
    select: { display_name: true, parent_email_verified_at: true },
  })

  if (!profile) {
    return (
      <Shell>
        <h1 className="mt-4 font-heading text-xl font-bold text-ink">This link isn’t valid</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We couldn’t find an account for this confirmation link. It may have been removed.
          If you think this is a mistake, reply to the email you received and we’ll help.
        </p>
      </Shell>
    )
  }

  const childName = profile.display_name || 'Your child'

  if (profile.parent_email_verified_at) {
    // Safety net — confirm normally clears the token, so this only renders if
    // verification happened through another path. Keep it generic.
    redirect('/verify-parent?done=1')
  }

  return (
    <Shell>
      <h1 className="mt-4 font-heading text-xl font-bold text-ink">
        Confirm {childName}’s account
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {childName} created a Decifer Learning account and named you as their parent or guardian.
        Decifer Learning collects limited personal data (name, email, learning progress) to operate
        the service.{' '}
        <Link href="/legal/privacy" className="font-semibold text-maths underline">
          Read our privacy policy.
        </Link>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        By confirming, you agree that you are {childName}’s parent or guardian and consent to them
        using Decifer Learning.
      </p>
      <form action={confirmConsent} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-maths font-semibold text-white transition active:scale-[0.98]"
        >
          Confirm — I’m {childName}’s parent or guardian
        </button>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Don’t recognise this? You can safely close this page, or reply to the email and we’ll
        remove the account.
      </p>
    </Shell>
  )
}
