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

const PUBLIC_EXACT = new Set<string>(['/', '/login', '/register'])
const STATIC_EXT =
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf|otf|txt|xml|json)$/i

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  if (pathname.startsWith('/_next/')) return true
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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return response

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
