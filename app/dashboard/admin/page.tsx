// Phase 1 admin role-boundary placeholder. Real monitoring + flagged-content
// regeneration land in Phase 12 per CLAUDE.md §14.

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { BarChart, Gift } from '@/components/ui/icons'

export const metadata = { title: 'Admin — Decifer Learning' }

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const displayName = user ? getUserDisplayName(user) : 'Admin'

  const [stagedQ, flaggedQ, stagedLC] = await Promise.all([
    prisma.quizQuestion.count({ where: { status: 'staged' } }),
    prisma.quizQuestion.count({ where: { status: 'flagged' } }),
    prisma.learnContent.count({ where: { status: 'staged' } }),
  ])

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">Hi {displayName}</h1>

      {/* Content health strip */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className={`rounded-xl px-3 py-3 ${stagedQ > 0 ? 'bg-lightning/20' : 'bg-black/[0.03]'}`}>
          <p className="font-heading text-xl font-bold text-ink">{stagedQ}</p>
          <p className="text-xs text-muted">questions staged</p>
        </div>
        <div className={`rounded-xl px-3 py-3 ${flaggedQ > 0 ? 'bg-incorrect/15' : 'bg-black/[0.03]'}`}>
          <p className={`font-heading text-xl font-bold ${flaggedQ > 0 ? 'text-incorrect' : 'text-ink'}`}>{flaggedQ}</p>
          <p className="text-xs text-muted">questions flagged</p>
        </div>
        <div className={`rounded-xl px-3 py-3 ${stagedLC > 0 ? 'bg-lightning/20' : 'bg-black/[0.03]'}`}>
          <p className="font-heading text-xl font-bold text-ink">{stagedLC}</p>
          <p className="text-xs text-muted">learn content staged</p>
        </div>
      </div>

      {stagedQ > 200 && (
        <div className="rounded-xl border border-lightning/30 bg-lightning/10 px-4 py-3 text-sm text-ink">
          ⚠️ <strong>{stagedQ} staged questions</strong> — review before bulk-publishing. Only promote via the pipeline verification gate.
        </div>
      )}
      {flaggedQ > 0 && (
        <div className="rounded-xl border border-incorrect/30 bg-incorrect/10 px-4 py-3 text-sm text-ink">
          🚩 <strong>{flaggedQ} flagged questions</strong> — these are hidden from children. Check the monitoring page and regenerate.
        </div>
      )}

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
