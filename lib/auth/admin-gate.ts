// Admin dashboard password gate — the single access control for /dashboard/admin/*
// and /api/admin/* (except the child-facing question-report endpoint).
//
// This module is deliberately free of `next/headers` and `server-only` so it can
// run in BOTH the edge middleware (which reads request.cookies) and Node route
// handlers / server components (which read next/headers cookies). Callers pass the
// cookie value in explicitly.
//
// The cookie never stores the raw password — it stores a SHA-256 token derived
// from the configured password plus a fixed app salt. The password itself lives
// only in the ADMIN_DASHBOARD_PASSWORD env var (see CLAUDE.md §6).

export const ADMIN_GATE_COOKIE = 'decifer_admin_gate'

// Cookie lifetime: 7 days. The admin re-enters the password after this.
export const ADMIN_GATE_MAX_AGE = 7 * 24 * 60 * 60

const TOKEN_SALT = 'decifer-admin-gate:v1:'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Length-stable comparison to avoid leaking match length via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// The token a valid gate cookie must carry. null when no password is configured.
export async function expectedGateToken(): Promise<string | null> {
  const pw = process.env.ADMIN_DASHBOARD_PASSWORD
  if (!pw) return null
  return sha256Hex(TOKEN_SALT + pw)
}

// True if the supplied cookie value is the current valid gate token.
export async function isGateTokenValid(value: string | undefined | null): Promise<boolean> {
  if (!value) return false
  const expected = await expectedGateToken()
  if (!expected) return false
  return safeEqual(value, expected)
}

// True if the supplied candidate equals the configured password.
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const pw = process.env.ADMIN_DASHBOARD_PASSWORD
  if (!pw) return false
  return safeEqual(candidate, pw)
}
