// Admin unlock screen — password gate entry point.
// Public (middleware allow-list): no Supabase session required to reach it.
// If already unlocked, bounce straight through to the dashboard.

import { redirect } from 'next/navigation'
import { hasAdminGate } from '@/lib/auth/admin-guard'
import { DeciferMark } from '@/components/ui/DeciferMark'
import { UnlockForm } from './UnlockForm'

export const metadata = { title: 'Admin — Unlock' }
export const dynamic = 'force-dynamic'

function safeRedirect(raw: string | undefined): string {
  // Only allow internal admin paths to prevent open-redirect.
  if (raw && raw.startsWith('/dashboard/admin') && !raw.startsWith('//')) return raw
  return '/dashboard/admin'
}

export default async function AdminUnlockPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string }
}) {
  const redirectTo = safeRedirect(searchParams.redirectTo)

  if (await hasAdminGate()) redirect(redirectTo)

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <DeciferMark size="xl" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-ink">Admin access</h1>
            <p className="text-sm text-muted mt-1">Enter the dashboard password to continue.</p>
          </div>
        </div>
        <UnlockForm redirectTo={redirectTo} />
        <p className="text-center text-xs text-muted">This area is restricted. Activity may be logged.</p>
      </div>
    </main>
  )
}
