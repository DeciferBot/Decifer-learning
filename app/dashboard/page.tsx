// Role gateway. Reads role from auth metadata, redirects to the role-scoped
// placeholder. If role is missing (shouldn't happen post-Phase-1 registration),
// fall back to /login so the user can re-authenticate.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole, ROLE_HOME } from '@/lib/auth/roles'

export default async function DashboardGatewayPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = getUserRole(user)
  if (!role) redirect('/login?reason=missing-role')

  redirect(ROLE_HOME[role])
}
