// Shared dashboard chrome. Server component — fetches the user once and renders
// the top nav. The gateway page and role-scoped placeholders all share this.

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
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

  // Middleware already guards this tree, but render-time defence keeps things
  // honest if a layout is ever exposed to an unauthenticated render path.
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <TopBar displayName={getUserDisplayName(user)} />
      <div className="mx-auto max-w-screen-md px-4 py-6">{children}</div>
    </div>
  )
}
