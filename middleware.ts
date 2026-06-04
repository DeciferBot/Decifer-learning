// Root middleware. Enforces:
//   1. Auth: protected routes require a Supabase session; otherwise redirect to /login
//   2. Role boundary: /dashboard/{child,parent,admin} require matching role
//
// Phase 1 scope only — no profile/family DB reads here. Role is read from
// auth.users.user_metadata (set at registration). Profile sync into the
// `profiles` table happens in Phase 2 after migrations land.
//
// Public allow-list: /, /login, /register, /_next/*, static assets.

import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getUserRole, ROLE_HOME, type Role } from '@/lib/auth/roles'
import { ADMIN_GATE_COOKIE, isGateTokenValid } from '@/lib/auth/admin-gate'

const PUBLIC_EXACT = new Set<string>([
  '/', '/login', '/register', '/reset-password',
  // Marketing + legal pages — must be reachable without a session.
  '/pricing', '/subjects', '/how-it-works',
  '/legal/terms', '/legal/privacy', '/legal/privacy-for-kids',
  // Admin password-gate entry points — must be reachable with no Supabase session.
  '/admin', '/api/admin/unlock',
])
// Auth callback must be public so the middleware never redirects the token exchange request.
// Help pages are public so unauthenticated visitors can read guides linked from the homepage.
const PUBLIC_PREFIX = ['/auth/callback', '/_next/', '/help', '/opengraph-image', '/twitter-image', '/sitemap', '/robots', '/legal/']
const STATIC_EXT =
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|otf|txt|xml|json)$/i

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  if (PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) return true
  if (pathname.startsWith('/favicon')) return true
  if (STATIC_EXT.test(pathname)) return true
  return false
}

// Map a role-prefixed pathname to its required role, if any.
function requiredRoleForPath(pathname: string): Role | null {
  if (pathname === '/dashboard/child' || pathname.startsWith('/dashboard/child/')) return 'child'
  if (pathname === '/dashboard/parent' || pathname.startsWith('/dashboard/parent/')) return 'parent'
  if (pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/')) return 'admin'
  return null
}

// The admin area is gated SOLELY by the password (lib/auth/admin-gate.ts), not by
// a Supabase session/role. The unlock screen + its API are in the public allow-list
// above. The question-report endpoint is exempt from the password gate because its
// POST is child-facing (children report problems); it enforces its own roles and
// still runs through the normal Supabase auth checks below.
function isAdminArea(pathname: string): boolean {
  return pathname.startsWith('/dashboard/admin') || pathname.startsWith('/api/admin')
}
function isAdminGateExempt(pathname: string): boolean {
  return pathname.startsWith('/api/admin/questions')
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return response

  // ── Admin password gate ── (runs before the Supabase auth/role checks)
  if (isAdminArea(pathname) && !isAdminGateExempt(pathname)) {
    const gated = await isGateTokenValid(request.cookies.get(ADMIN_GATE_COOKIE)?.value)
    if (gated) return response
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Admin dashboard locked', code: 'ADMIN_LOCKED' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/dashboard') {
      url.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(url)
  }

  const role = getUserRole(user)

  // /dashboard is the role gateway. The page itself redirects to /dashboard/<role>.
  if (pathname === '/dashboard') return response

  const needed = requiredRoleForPath(pathname)
  if (needed && role !== needed) {
    // Wrong role for this area — bounce to the user's own home.
    const home = role ? ROLE_HOME[role] : '/dashboard'
    return NextResponse.redirect(new URL(home, request.url))
  }

  return response
}

export const config = {
  // Skip Next.js internal assets and the icon files we ship in /public.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-).*)'],
}
