import 'server-only'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_GATE_COOKIE, isGateTokenValid } from '@/lib/auth/admin-gate'

// Access to the admin dashboard is controlled solely by the password gate
// (see lib/auth/admin-gate.ts). Middleware is the real enforcement boundary;
// these helpers are defense-in-depth for server components and route handlers.

// True if the current request carries a valid admin-gate cookie.
export async function hasAdminGate(): Promise<boolean> {
  const value = cookies().get(ADMIN_GATE_COOKIE)?.value
  return isGateTokenValid(value)
}

// For server components / pages. Redirects to the unlock screen if not gated.
export async function requireAdmin(redirectTo = '/dashboard/admin'): Promise<void> {
  if (!(await hasAdminGate())) {
    redirect(`/admin?redirectTo=${encodeURIComponent(redirectTo)}`)
  }
}

// For route handlers. Returns a 401 JSON response if not gated, else null.
export async function requireAdminApi(): Promise<NextResponse | null> {
  if (await hasAdminGate()) return null
  return NextResponse.json({ error: 'Admin dashboard locked', code: 'ADMIN_LOCKED' }, { status: 401 })
}
