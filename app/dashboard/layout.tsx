// Shared dashboard chrome. Server component — fetches the user once and renders
// the top nav. The gateway page and role-scoped placeholders all share this.
//
// The admin area is gated by a password rather than a Supabase session
// (lib/auth/admin-gate.ts). Middleware guarantees that any session-less request
// reaching this layout is a valid gate-holder, so we allow it through and label
// the chrome "Admin".

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
import { hasAdminGate } from '@/lib/auth/admin-guard'
import { TopBar } from '@/components/ui/TopBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware guards this tree. Render-time defence: allow a session unless the
  // request is a password-gated admin (no Supabase session, but a valid gate cookie).
  if (!user && !(await hasAdminGate())) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <TopBar displayName={user ? getUserDisplayName(user) : 'Admin'} />
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-10 py-6">{children}</div>
    </div>
  )
}
