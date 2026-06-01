// Admin home — operations hub. Surfaces top-line user + content health, then
// links into the focused admin areas (Users, Monitoring, Coverage, Vault).
// Admin-only: middleware gates /dashboard/admin/*, requireAdmin() re-checks the
// role against the profiles table before any data is read.

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { BarChart, Gift, Users, Flag, RefreshCw } from '@/components/ui/icons'
import { LockButton } from './LockButton'

export const metadata = { title: 'Admin — Decifer Learning' }
export const revalidate = 30

const DAY = 86_400_000

export default async function AdminDashboardPage() {
  await requireAdmin()

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const displayName = user ? getUserDisplayName(user) : 'Admin'

  const now = Date.now()
  const ago7 = new Date(now - 7 * DAY)

  const [totalUsers, new7d, active7d, quizzes7d, stagedQ, flaggedQ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { created_at: { gte: ago7 } } }),
    prisma.profile.count({ where: { last_active: { gte: ago7 } } }),
    prisma.quizAttempt.count({ where: { created_at: { gte: ago7 } } }),
    prisma.quizQuestion.count({ where: { status: 'staged' } }),
    prisma.quizQuestion.count({ where: { status: 'flagged' } }),
  ])

  // question_reports may not be migrated in every environment — degrade to 0.
  const openReports = await prisma.questionReport
    .count({ where: { status: 'open' } })
    .catch(() => 0)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-ink">Hi {displayName}</h1>
        <LockButton />
      </div>

      {/* People at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <Kpi label="Total users" value={totalUsers} />
        <Kpi label="New this week" value={new7d} accent="brand" />
        <Kpi label="Active 7d" value={active7d} accent="correct" />
        <Kpi label="Quizzes 7d" value={quizzes7d} />
      </div>

      {/* Alerts */}
      {flaggedQ > 0 && (
        <div className="rounded-xl border border-incorrect/30 bg-incorrect/10 px-4 py-3 text-sm text-ink">
          🚩 <strong>{flaggedQ} flagged question{flaggedQ === 1 ? '' : 's'}</strong> — hidden from children. Review in Monitoring.
        </div>
      )}
      {openReports > 0 && (
        <div className="rounded-xl border border-lightning/30 bg-lightning/10 px-4 py-3 text-sm text-ink">
          📣 <strong>{openReports} open problem report{openReports === 1 ? '' : 's'}</strong> from children — awaiting review.
        </div>
      )}
      {stagedQ > 200 && (
        <div className="rounded-xl border border-lightning/30 bg-lightning/10 px-4 py-3 text-sm text-ink">
          ⚠️ <strong>{stagedQ} staged questions</strong> — promote only via the pipeline verification gate.
        </div>
      )}

      {/* Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NavCard
          href="/dashboard/admin/users"
          icon={<Users className="w-5 h-5" aria-hidden />}
          title="Users & Activity"
          desc="Registrations, engagement, the full member list"
        />
        <NavCard
          href="/dashboard/admin/monitoring"
          icon={<Flag className="w-5 h-5" aria-hidden />}
          title="Monitoring"
          desc="Flagged questions and open child reports"
          badge={flaggedQ + openReports > 0 ? flaggedQ + openReports : undefined}
        />
        <NavCard
          href="/dashboard/admin/coverage"
          icon={<BarChart className="w-5 h-5" aria-hidden />}
          title="Content Coverage"
          desc="Topic and pipeline generation status"
        />
        <NavCard
          href="/dashboard/admin/pipeline"
          icon={<RefreshCw className="w-5 h-5" aria-hidden />}
          title="Pipeline"
          desc="Run health and generation controls"
        />
        <NavCard
          href="/dashboard/admin/vault"
          icon={<Gift className="w-5 h-5" aria-hidden />}
          title="Reward Vault"
          desc="Reward requests, fulfilment and catalogue"
          brand
        />
      </div>
    </section>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: 'brand' | 'correct' }) {
  const colour = accent === 'brand' ? 'text-brand' : accent === 'correct' ? 'text-correct' : 'text-ink'
  return (
    <div className="rounded-xl border border-black/5 bg-surface px-3 py-3 shadow-sm">
      <p className={`font-heading text-xl font-bold ${colour}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

function NavCard({
  href,
  icon,
  title,
  desc,
  badge,
  brand,
}: {
  href: string
  icon: React.ReactNode
  title: string
  desc: string
  badge?: number
  brand?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[48px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-colors ${
        brand ? 'border-brand/20 bg-brand/5 hover:bg-brand/10' : 'border-black/5 bg-surface hover:bg-black/[0.03]'
      }`}
    >
      <span className={`flex-none ${brand ? 'text-brand' : 'text-ink'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-2 font-heading text-sm font-semibold ${brand ? 'text-brand' : 'text-ink'}`}>
          {title}
          {badge !== undefined && (
            <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-incorrect px-1.5 text-[11px] font-bold text-white">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
      <span className={`text-xs ${brand ? 'text-brand' : 'text-muted'}`}>→</span>
    </Link>
  )
}
