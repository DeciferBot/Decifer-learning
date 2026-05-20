import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Handles Supabase email-confirmation and magic-link callbacks (PKCE flow).
// Supabase redirects here after the user clicks the confirmation link:
//   https://yourapp.com/auth/callback?code=<pkce-code>
// We exchange the code for a session, then redirect to /dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Code missing or exchange failed — send to login with a visible error flag.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
