// Child dashboard placeholder — proves Phase 2 DB wiring by reading the user's
// own profile row (RLS policy "profiles_select_self"). Quiz / world map / cards
// / points land in Phases 4–8 per CLAUDE.md §14.

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'

export const metadata = { title: 'Dashboard — Decifer Learning' }

export default async function ChildDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Middleware + layout already guard this; user is non-null here.
  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const displayName = profile?.display_name ?? (user ? getUserDisplayName(user) : 'Explorer')
  const yearGroup = MVP_YEAR_GROUPS.find((y) => y.label === profile?.year_group_label)

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
