// Phase 1 child dashboard placeholder. No quiz / world map / cards / points yet.
// Those land in Phases 4–8 per CLAUDE.md §14.

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, getUserYearGroup, MVP_YEAR_GROUPS } from '@/lib/auth/roles'

export const metadata = { title: 'Dashboard — Decipher Learning' }

export default async function ChildDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Middleware + layout already guard this; user is non-null here.
  const displayName = user ? getUserDisplayName(user) : 'Explorer'
  const yearGroupLabel = user ? getUserYearGroup(user) : null
  const yearGroup = MVP_YEAR_GROUPS.find((y) => y.label === yearGroupLabel)

  return (
    <section className="space-y-3">
      <h1 className="font-heading text-2xl font-bold">
        Hi {displayName} 👋
      </h1>
      <p className="text-sm text-muted">
        {yearGroup ? `${yearGroup.display} (${yearGroup.keyStage})` : 'Year group not set.'}
      </p>
      <p className="text-sm text-muted">
        Your world map and quizzes arrive in the next build phases.
      </p>
    </section>
  )
}
