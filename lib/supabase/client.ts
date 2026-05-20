// Browser-side Supabase client. Use ONLY inside `'use client'` components.
// For server components and route handlers, use lib/supabase/server.ts instead.
// For middleware, use lib/supabase/middleware.ts.

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See CLAUDE.md §6.'
    )
  }
  return createBrowserClient(url, anonKey)
}
