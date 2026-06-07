// REMOVED — password-cookie admin gate replaced by Supabase role-based auth.
// Use lib/auth/admin-guard.ts (hasAdminRole / requireAdmin / requireAdminApi).
// Any import of this file is a bug — it will cause a TypeScript error at build time.
throw new Error('lib/auth/admin-gate.ts has been removed. Use lib/auth/admin-guard.ts.')
export {}
