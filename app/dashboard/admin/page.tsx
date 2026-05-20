// Phase 1 admin role-boundary placeholder. Real monitoring + flagged-content
// regeneration land in Phase 12 per CLAUDE.md §14.

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'

export const metadata = { title: 'Admin — Decipher Learning' }

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const displayName = user ? getUserDisplayName(user) : 'Admin'

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-bold">Hi {displayName}</h1>
      <p className="text-sm text-muted">
        Admin role boundary verified. Monitoring tools arrive in Phase 12.
      </p>
    </section>
  )
}
