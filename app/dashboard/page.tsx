// Role gateway. Reads role from Supabase auth metadata, redirects to the
// role-scoped home. If role is missing, fall back to /login.
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
