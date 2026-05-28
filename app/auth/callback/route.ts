import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Handles two Supabase auth callback shapes:
//
// 1. token_hash + type  — email confirmation and password-reset links.
//    Supabase embeds a token_hash in the confirmation email and the link lands
//    here as ?token_hash=xxx&type=signup (or type=recovery, type=email, etc.).
//    We call verifyOtp to exchange it for a session.
//
// 2. code               — PKCE code exchange for OAuth and magic-link flows.
//    We call exchangeCodeForSession to turn it into a session.
//
// Both paths redirect to /dashboard (or ?next=...) on success.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const supabase = createSupabaseServerClient()

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Both paths failed — send to login with a visible error flag.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
