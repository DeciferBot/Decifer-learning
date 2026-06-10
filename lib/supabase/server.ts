// Server-side Supabase client for React Server Components and route handlers.
// Reads + writes the auth cookie via next/headers. The setAll handler swallows
// errors in pure-RSC render contexts where cookie mutation is disallowed;
// the middleware layer is responsible for the cookie refresh in those cases.

import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'

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

// getUser() is a network round-trip to the Supabase Auth server. Layouts and
// pages in the same request tree both need the verified user, so memoize the
// call per request — one Auth round-trip per navigation instead of one per
// Server Component.
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
