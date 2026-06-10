export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, getUserRole } from '@/lib/auth/roles'
import { childNeedsOnboarding } from '@/lib/onboarding'
import { TopBar } from '@/components/ui/TopBar'
import { BottomNav } from '@/components/ui/BottomNav'
import { ConsentBanner } from '@/components/child/ConsentBanner'
import { prisma } from '@/lib/prisma'
import { getConsentGate, type ConsentGate } from '@/lib/parental-consent'

const VALID_THEMES = new Set(['default', 'maths', 'english', 'science', 'night'])

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = getUserRole(user)
  // Non-child roles get bounced to their own dashboard
  if (role && role !== 'child') redirect('/dashboard')

  // First-run gate: a child who hasn't seen the avatar + about-me prompt goes
  // to /onboarding (which lives outside this route group, so no redirect loop).
  if (await childNeedsOnboarding(user.id)) redirect('/onboarding')

  // Read saved theme — fail-open (undefined = default, no data-theme attr)
  let theme: string | undefined
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: user.id },
      select: { theme_name: true },
    })
    const saved = profile?.theme_name ?? 'default'
    if (saved && saved !== 'default' && VALID_THEMES.has(saved)) theme = saved
  } catch {
    // theme stays undefined — default styling
  }

  // Parental-consent banner — fail-open: a DB hiccup must never block the app.
  let consentGate: ConsentGate = { state: 'verified' }
  try {
    consentGate = await getConsentGate(user.id)
  } catch {
    // banner simply not shown
  }

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
