// Supabase client for Next.js middleware. Refreshes the auth cookie on every
// matching request and returns the resolved user (or null) for route guards.

import { createServerClient } from '@supabase/ssr'
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
    return { response, user: null }
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request: { headers: request.headers } })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Use getSession() here — it reads the JWT from cookies without a network
  // round-trip to Supabase. getUser() (network-verified) is ~500–3000 ms per
  // request and runs on every page; middleware only needs to know whether a
  // session exists for route gating. Server components and API routes that
  // need a verified user call getUser() themselves.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { response, user: session?.user ?? null }
}
