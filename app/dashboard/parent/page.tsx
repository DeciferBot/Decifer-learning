// Phase 1 parent dashboard placeholder. Per-child progress, weak areas, and
// screen-time controls land in Phase 9 per CLAUDE.md §14.

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'

export const metadata = { title: 'Parent dashboard — Decifer Learning' }

export default async function ParentDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const displayName = user ? getUserDisplayName(user) : 'Parent'

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-bold">Hi {displayName}</h1>
      <p className="text-sm text-muted">
        Per-child progress, weak areas, and screen-time controls arrive in Phase 9.
      </p>
    </section>
  )
}
