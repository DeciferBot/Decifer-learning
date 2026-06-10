export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { getUserDisplayName, getUserRole } from '@/lib/auth/roles'
import { TopBar } from '@/components/ui/TopBar'
import { BottomNav } from '@/components/ui/BottomNav'
import { ConsentBanner } from '@/components/child/ConsentBanner'
import { getChildGate, type ChildGate } from '@/lib/child-gate'

const VALID_THEMES = new Set(['default', 'maths', 'english', 'science', 'night'])

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) redirect('/login')

  const role = getUserRole(user)
  // Non-child roles get bounced to their own dashboard
  if (role && role !== 'child') redirect('/dashboard')

  // One combined profile read covers onboarding, theme, and consent —
  // fail-open so a DB hiccup never blocks the app.
  let gate: ChildGate = {
    role: null,
    needsOnboarding: false,
    theme: 'default',
    consent: { state: 'verified' },
  }
  try {
    gate = await getChildGate(user.id)
  } catch {
    // defaults above: default theme, no banner, no onboarding redirect
  }

  // First-run gate: a child who hasn't seen the avatar + about-me prompt goes
  // to /onboarding (which lives outside this route group, so no redirect loop).
  if (gate.needsOnboarding) redirect('/onboarding')

  const theme =
    gate.theme !== 'default' && VALID_THEMES.has(gate.theme) ? gate.theme : undefined
  const consentGate = gate.consent

  return (
    <div className="min-h-screen bg-background" {...(theme ? { 'data-theme': theme } : {})}>
      <TopBar displayName={getUserDisplayName(user)} />
      {consentGate.state !== 'verified' ? (
        <ConsentBanner
          state={consentGate.state}
          daysLeft={consentGate.state === 'grace' ? consentGate.daysLeft : undefined}
          hasParentEmail={consentGate.hasParentEmail}
          userId={user.id}
        />
      ) : null}
      {/* pb-20 keeps content clear of the 56px bottom nav + safe-area inset */}
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-10 py-6 pb-24">{children}</div>
      <BottomNav />
    </div>
  )
}
