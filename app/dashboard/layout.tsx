// Shared dashboard chrome. Server component — fetches the user once and renders
// the top nav. The gateway page and role-scoped placeholders all share this.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, getUserRole } from '@/lib/auth/roles'
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

  if (!user) redirect('/login')

  const role = getUserRole(user)
  const isAdmin = role === 'admin'

  return (
    <div className="min-h-screen bg-background">
      <TopBar displayName={getUserDisplayName(user)} showAdminLink={isAdmin} />
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-10 py-6">{children}</div>
    </div>
  )
}
