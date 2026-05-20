// Server-side Supabase client for React Server Components and route handlers.
// Reads + writes the auth cookie via next/headers. Some RSC contexts disallow
// cookie mutation (e.g. inside a pure server component render); we swallow that
// error because the middleware layer is responsible for cookie refresh.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
      get(name: string): string | undefined {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions): void {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // RSC render contexts disallow cookie mutation — middleware refreshes.
        }
      },
      remove(name: string, options: CookieOptions): void {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // Same as above.
        }
      },
    },
  })
}
