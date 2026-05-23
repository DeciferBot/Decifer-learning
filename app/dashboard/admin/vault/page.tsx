import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { getAllRequests, getVaultStats } from '@/lib/vault/admin'

export const metadata = { title: 'Vault Admin — Decifer Learning' }

export default async function AdminVaultPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || getUserRole(user) !== 'admin') notFound()

  const [stats, requests] = await Promise.all([
    getVaultStats(),
    getAllRequests({ limit: 50 }),
  ])

  const STATUS_COLOUR: Record<string, string> = {
    pending:        'bg-points-gold/20 text-points-gold',
    approved:       'bg-correct/20 text-correct',
    rejected:       'bg-incorrect/20 text-incorrect',
    completed:      'bg-science/20 text-science',
    deferred:       'bg-black/10 text-muted',
    counter_offered:'bg-maths/20 text-maths',
    cancelled:      'bg-black/10 text-muted',
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-ink">Reward Vault</h1>
        <Link href="/dashboard/admin" className="text-sm text-muted hover:text-ink">← Admin</Link>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total requests',   value: stats.totalRequests },
          { label: 'Pending',          value: stats.pendingRequests },
          { label: 'Approved',         value: stats.approvedRequests },
          { label: 'Rejected',         value: stats.rejectedRequests },
          { label: 'Completed',        value: stats.completedRequests },
          { label: 'Credits awarded',  value: stats.totalCreditsAwarded },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-black/5 bg-surface p-4 text-center shadow-sm">
            <div className="font-heading text-2xl font-bold text-brand">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Request table ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 bg-surface shadow-sm overflow-hidden">
        <div className="border-b border-black/5 px-5 py-3">
          <h2 className="font-heading text-sm font-semibold text-ink">Recent requests</h2>
        </div>
        {requests.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {requests.map((r) => (
              <li key={r.id} className="px-5 py-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-heading text-sm font-semibold text-ink">{r.childName}</span>
                    <span className="mx-1 text-muted">→</span>
                    <span className="text-sm text-muted">{r.parentName}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${STATUS_COLOUR[r.status] ?? 'bg-black/5 text-muted'}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="capitalize">{r.milestoneBand} milestone</span>
                  <span>{r.xpAtRequest.toLocaleString()} XP</span>
                  <span>{r.topicsAtRequest} topics</span>
                  <span>{new Date(r.createdAt).toLocaleDateString('en-GB')}</span>
                </div>
                {r.childMessage && (
                  <p className="text-xs italic text-muted">&ldquo;{r.childMessage}&rdquo;</p>
                )}
                {r.rewardLabel && (
                  <p className="text-xs text-ink">Reward: {r.rewardLabel}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
