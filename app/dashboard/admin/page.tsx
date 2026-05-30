// Phase 1 admin role-boundary placeholder. Real monitoring + flagged-content
// regeneration land in Phase 12 per CLAUDE.md §14.

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
import { BarChart, Gift } from '@/components/ui/icons'

export const metadata = { title: 'Admin — Decifer Learning' }

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const displayName = user ? getUserDisplayName(user) : 'Admin'

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Hi {displayName}</h1>
      <p className="text-sm text-muted">
        Admin role boundary verified. Monitoring tools arrive in Phase 12.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/admin/coverage"
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm hover:bg-black/[0.03]"
        >
          <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1"><BarChart className="w-4 h-4" aria-hidden /> Content Coverage</span>
          <span className="text-xs text-muted">→</span>
        </Link>
        <Link
          href="/dashboard/admin/vault"
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 shadow-sm hover:bg-brand/10"
        >
          <span className="font-heading text-sm font-semibold text-brand flex items-center gap-1"><Gift className="w-4 h-4" aria-hidden /> Reward Vault</span>
          <span className="text-xs text-brand">→</span>
        </Link>
      </div>
    </section>
  )
}
