// Single source of truth for verifying Supabase email links (password reset,
// magic link, signup + email-change confirmation).
//
// Why this exists — the "expired on first click" bug:
//   The browser Supabase client uses the PKCE flow, so a `?code=` link can only
//   be exchanged (exchangeCodeForSession) in the SAME browser that requested it,
//   because it needs that browser's `code_verifier` cookie. On mobile the reset
//   is requested in Safari but the emailed link opens inside the Gmail/Mail
//   in-app webview — a different cookie jar — so the exchange fails and the user
//   sees "this link has expired". Opening the link on a second device fails the
//   same way, and an email security scanner that pre-fetches the Supabase
//   `/verify` hop can consume a one-time `?code=` link before the human clicks.
//
//   verifyOtp({ token_hash, type }) does NOT depend on the code_verifier cookie,
//   so it succeeds in any browser, device, or in-app webview. That is the fix.
//   New email templates embed {{ .TokenHash }} and land on /auth/confirm; this
//   handler also still accepts `?code=` so links already delivered with the old
//   {{ .ConfirmationURL }} template (and any OAuth flow) keep working.

import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// The EmailOtpType union, as a runtime guard for the untrusted `type` query param.
const VALID_OTP_TYPES: ReadonlySet<string> = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

// Only allow same-site, absolute-path redirect targets. Anything else — a
// protocol-relative `//evil.com`, an absolute URL, a back-slash trick, or a
// missing value — falls back to the dashboard. Stops `?next=` from becoming an
// open redirect.
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/')) return '/dashboard'
  if (next.startsWith('//') || next.startsWith('/\\')) return '/dashboard'
  return next
}

export async function handleEmailAuthRequest(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl
  const params = url.searchParams
  const next = safeNext(params.get('next'))

  // Build a redirect that preserves the request's own scheme + host (correct
  // behind the Vercel proxy), never leaking the incoming query string or hash.
  const redirect = (pathname: string, search?: Record<string, string>): NextResponse => {
    const dest = url.clone()
    dest.pathname = pathname
    dest.search = ''
    dest.hash = ''
    if (search) {
      for (const [key, value] of Object.entries(search)) dest.searchParams.set(key, value)
    }
    return NextResponse.redirect(dest)
  }

  const successRedirect = (): NextResponse => {
    const [pathname, query = ''] = next.split('?')
    const dest = url.clone()
    dest.pathname = pathname
    dest.search = query
    dest.hash = ''
    return NextResponse.redirect(dest)
  }

  // Recovery links keep the user in the reset context so they can request a
  // fresh one; every other failure returns to /login with a friendly flag.
  const failureRedirect = (): NextResponse =>
    next.startsWith('/reset-password')
      ? redirect('/reset-password', { error: 'link_invalid' })
      : redirect('/login', { error: 'link_invalid' })

  // Supabase may bounce the user back with an explicit error on an already
  // consumed or expired link (e.g. ?error=access_denied&error_code=otp_expired).
  // Honour it rather than attempting to verify a token that isn't there.
  if (params.get('error') || params.get('error_code')) {
    return failureRedirect()
  }

  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const code = params.get('code')

  const supabase = createSupabaseServerClient()

  // Preferred path: token_hash + type → verifyOtp. Cookie-independent, so it
  // works no matter where the email is opened.
  if (tokenHash && type && VALID_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })
    return error ? failureRedirect() : successRedirect()
  }

  // Backward-compatible path: PKCE `?code=` (old email template, or OAuth).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return error ? failureRedirect() : successRedirect()
  }

  // No recognizable auth payload.
  return failureRedirect()
}
