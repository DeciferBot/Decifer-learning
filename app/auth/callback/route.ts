import { type NextRequest } from 'next/server'
import { handleEmailAuthRequest } from '@/lib/auth/verify-email-link'

// Legacy + OAuth/PKCE callback. Retained for backward compatibility with links
// already delivered under the old {{ .ConfirmationURL }} template (which arrive
// here as ?code=…) and for any OAuth provider flow. Delegates to the same
// handler as /auth/confirm, which accepts BOTH token_hash and code payloads, so
// in-flight links keep working while new emails point at /auth/confirm.
export async function GET(request: NextRequest) {
  return handleEmailAuthRequest(request)
}
