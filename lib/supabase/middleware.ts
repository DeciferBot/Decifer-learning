// Supabase client for Next.js middleware. Refreshes the auth cookie on every
// matching request and returns the resolved user (or null) for route guards.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  user: User | null
}> {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    // Without Supabase env vars we can't resolve a session — treat as logged out.
    return { response, user: null }
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string): string | undefined {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions): void {
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions): void {
        request.cookies.set({ name, value: '', ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
