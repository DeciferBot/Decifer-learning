// Shared dashboard chrome. Server component — fetches the user once and renders
// the top nav. The gateway page and role-scoped placeholders all share this.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { getUserDisplayName, getUserRole } from '@/lib/auth/roles'
import { TopBar } from '@/components/ui/TopBar'
import { ConsentBanner } from '@/components/child/ConsentBanner'
import { getChildGate } from '@/lib/child-gate'
import type { ConsentGate } from '@/lib/parental-consent'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) redirect('/login')

  const role = getUserRole(user)
  const isAdmin = role === 'admin'

  // Parental-consent banner (child accounts only) — fail-open on DB errors.
  let consentGate: ConsentGate = { state: 'verified' }
  if (role === 'child') {
    try {
      consentGate = (await getChildGate(user.id)).consent
    } catch {
      // banner simply not shown
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar displayName={getUserDisplayName(user)} showAdminLink={isAdmin} showThemeToggle />
      {consentGate.state !== 'verified' ? (
        <ConsentBanner
          state={consentGate.state}
          daysLeft={consentGate.state === 'grace' ? consentGate.daysLeft : undefined}
          hasParentEmail={consentGate.hasParentEmail}
          userId={user.id}
        />
      ) : null}
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-10 py-6">{children}</div>
    </div>
  )
}
