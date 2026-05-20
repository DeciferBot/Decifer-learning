// Server-side Supabase client for React Server Components and route handlers.
// Reads + writes the auth cookie via next/headers. The setAll handler swallows
// errors in pure-RSC render contexts where cookie mutation is disallowed;
// the middleware layer is responsible for the cookie refresh in those cases.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See CLAUDE.md §6.'
    )
  }

  const cookieStore = cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // RSC render contexts disallow cookie mutation — middleware refreshes.
        }
      },
    },
  })
}
