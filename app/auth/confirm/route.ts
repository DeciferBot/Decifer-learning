import { type NextRequest } from 'next/server'
import { handleEmailAuthRequest } from '@/lib/auth/verify-email-link'

// Canonical landing route for Supabase email links: password reset, magic link,
// and signup / email-change confirmation. The email templates embed
// {{ .TokenHash }} and point here, so verification runs through
// verifyOtp({ token_hash, type }) — which does NOT depend on the PKCE
// code_verifier cookie and therefore succeeds in any browser, device, or in-app
// webview. This is the flow that fixes "the link says it has expired on first
// click". See lib/auth/verify-email-link.ts for the full rationale.
export async function GET(request: NextRequest) {
  return handleEmailAuthRequest(request)
}
