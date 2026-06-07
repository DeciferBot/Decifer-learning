import 'server-only'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'

// Admin access is enforced by Supabase role ('admin' in user_metadata).
// No shared password cookie — identity is always tied to the logged-in user.

// True if the current request's Supabase session has role === 'admin'.
export async function hasAdminRole(): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return getUserRole(user) === 'admin'
}

// For server components / pages. Redirects to /login if not an admin.
export async function requireAdmin(): Promise<void> {
  if (!(await hasAdminRole())) {
    redirect('/login?reason=not-admin')
  }
}

// For route handlers. Returns a 401 JSON response if not an admin, else null.
export async function requireAdminApi(): Promise<NextResponse | null> {
  if (await hasAdminRole()) return null
  return NextResponse.json({ error: 'Admin access required', code: 'FORBIDDEN' }, { status: 403 })
}
