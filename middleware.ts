// Root middleware. Enforces:
//   1. Auth: protected routes require a Supabase session; otherwise redirect to /login
//   2. Role boundary: /dashboard/admin requires role==='admin', /dashboard/parent requires parent, etc.
//
// Admin access is enforced by Supabase role (user_metadata.role === 'admin').
// There is NO password-cookie gate — admin is a user identity, not a device state.

import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getUserRole, canActAsParent, ROLE_HOME, type Role } from '@/lib/auth/roles'

const PUBLIC_EXACT = new Set<string>([
  '/', '/login', '/register', '/reset-password',
  // Marketing + legal pages — must be reachable without a session.
  '/pricing', '/subjects', '/how-it-works',
  '/legal/terms', '/legal/privacy', '/legal/privacy-for-kids',
])
// Auth callback must be public so the middleware never redirects the token exchange request.
// Help pages are public so unauthenticated visitors can read guides linked from the homepage.
// Vercel Cron routes carry no session cookie — they self-authenticate via the CRON_SECRET
// bearer header inside each handler, so the middleware must NOT redirect them to /login.
const PUBLIC_PREFIX = ['/auth/callback', '/_next/', '/help', '/opengraph-image', '/twitter-image', '/sitemap', '/robots', '/legal/', '/api/cron/']
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
  if (pathname.startsWith('/api/admin/')) return 'admin'
  return null
}

// The question-report endpoint is child-facing — exempt from the admin role check.
function isAdminRoleExempt(pathname: string): boolean {
  return pathname.startsWith('/api/admin/questions')
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip the Supabase auth network call entirely for public routes — it adds
  // 500–3000 ms of latency on every request, including the public homepage.
  if (isPublic(pathname)) return NextResponse.next()

  const { response, user } = await updateSession(request)

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/dashboard') {
      url.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(url)
  }

  const role = getUserRole(user)

  // /dashboard is the role gateway — the page itself redirects to /dashboard/<role>.
  if (pathname === '/dashboard') return response

  const needed = isAdminRoleExempt(pathname) ? null : requiredRoleForPath(pathname)
  // Admin is a superset of parent: allow admins into /dashboard/parent/* to oversee
  // their own linked children. All other role gates remain exact.
  const allowed = !needed || role === needed || (needed === 'parent' && canActAsParent(role))
  if (!allowed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }
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
