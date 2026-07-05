// Admin home — operations hub. Surfaces top-line user + content health, then
// links into the focused admin areas (Users, Monitoring, Coverage, Vault).
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getAuthUser } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { BarChart, Gift, Users, Flag, RefreshCw, TrendingUp, BookOpen, Bell, AlertTriangle } from '@/components/ui/icons'
import { LockButton } from './LockButton'

export const metadata = { title: 'Admin' }
export const revalidate = 30

const DAY = 86_400_000

export default async function AdminDashboardPage() {
  await requireAdmin()

  const user = await getAuthUser()
  const displayName = user ? getUserDisplayName(user) : 'Admin'

  const now = Date.now()
  const ago7  = new Date(now - 7 * DAY)
  const ago24 = new Date(now - DAY)

  const [
    totalUsers,
    new7d,
    active7d,
    active24h,
    children,
    parents,
    quizzes7d,
    avgScore7d,
    stagedQ,
    flaggedQ,
    publishedQ,
    openReports,
    totalTopics,
    publishedTopics,
    subjects,
    pendingVaultRequests,
    subscriptions,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { created_at: { gte: ago7 } } }),
    prisma.profile.count({ where: { last_active: { gte: ago7 } } }),
    prisma.profile.count({ where: { last_active: { gte: ago24 } } }),
    prisma.profile.count({ where: { role: 'child' } }),
    prisma.profile.count({ where: { role: 'parent' } }),
    prisma.quizAttempt.count({ where: { created_at: { gte: ago7 } } }),
    prisma.quizAttempt.aggregate({ where: { created_at: { gte: ago7 } }, _avg: { score: true } }),
    prisma.quizQuestion.count({ where: { status: 'staged' } }),
    prisma.quizQuestion.count({ where: { status: 'flagged' } }),
    prisma.quizQuestion.count({ where: { status: 'published' } }),
    prisma.questionReport.count({ where: { status: 'open' } }).catch(() => 0),
    prisma.topic.count(),
    prisma.topic.count({ where: { is_published: true } }),
    prisma.subject.findMany({ select: { id: true, name: true } }),
    prisma.rewardRequest.count({ where: { status: { in: ['pending', 'approved'] } } }).catch(() => 0),
    prisma.subscription.count({ where: { status: 'active' } }).catch(() => 0),
  ])

  // Per-subject published question counts
  const qBySubject = await prisma.quizQuestion.groupBy({
    by: ['topic_id'],
    where: { status: 'published' },
    _count: { _all: true },
  })
  const topicSubjectMap = await prisma.topic.findMany({
    where: { id: { in: qBySubject.map((r) => r.topic_id) } },
    select: { id: true, subject: { select: { name: true } } },
  })
  const tsmIndex = new Map(topicSubjectMap.map((t) => [t.id, t.subject?.name ?? 'Unknown']))
  const qCountBySubject = new Map<string, number>()
  for (const row of qBySubject) {
    const sName = tsmIndex.get(row.topic_id) ?? 'Unknown'
    qCountBySubject.set(sName, (qCountBySubject.get(sName) ?? 0) + row._count._all)
  }

  const avgScore = avgScore7d._avg.score
  const topicsHealthPct = totalTopics > 0 ? Math.round((publishedTopics / totalTopics) * 100) : 0

  const alerts: { colour: 'red' | 'yellow'; icon: React.ReactNode; message: string; href?: string }[] = []
  if (flaggedQ > 0)
    alerts.push({ colour: 'red', icon: <Flag className="w-4 h-4" aria-hidden />, message: `${flaggedQ} flagged question${flaggedQ === 1 ? '' : 's'}, hidden from children`, href: '/dashboard/admin/monitoring' })
  if (openReports > 0)
    alerts.push({ colour: 'yellow', icon: <Bell className="w-4 h-4" aria-hidden />, message: `${openReports} open problem report${openReports === 1 ? '' : 's'} from children`, href: '/dashboard/admin/monitoring' })
  if (pendingVaultRequests > 0)
    alerts.push({ colour: 'yellow', icon: <Gift className="w-4 h-4" aria-hidden />, message: `${pendingVaultRequests} vault reward request${pendingVaultRequests === 1 ? '' : 's'} awaiting fulfilment`, href: '/dashboard/admin/vault' })
  if (stagedQ > 200)
    alerts.push({ colour: 'yellow', icon: <AlertTriangle className="w-4 h-4" aria-hidden />, message: `${stagedQ} staged questions: promote only via the pipeline gate` })

  return (
    <section className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Hi {displayName}</h1>
          <p className="text-sm text-muted mt-0.5">Platform overview</p>
        </div>
        <LockButton />
      </div>

      {/* Alerts — entire row is clickable when there's a destination */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const inner = (
              <>
                <span className="flex-none">{a.icon}</span>
                <span className="flex-1"><strong>{a.message}</strong></span>
                {a.href && <span className="flex-none text-xs font-medium text-brand">Review →</span>}
              </>
            )
            const cls = `rounded-xl border px-4 py-3 text-sm text-ink flex items-center gap-2 ${
              a.colour === 'red'
                ? 'border-incorrect/30 bg-incorrect/10'
                : 'border-lightning/30 bg-lightning/10'
            }`
            return a.href ? (
              <Link key={i} href={a.href} className={`${cls} hover:opacity-80 transition-opacity`}>
                {inner}
              </Link>
            ) : (
              <div key={i} className={cls}>{inner}</div>
            )
          })}
        </div>
      )}

      {/* Users at a glance */}
      <div>
        <h2 className="font-heading text-sm font-semibold text-muted uppercase tracking-wide mb-2">Users</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Kpi label="Total users" value={totalUsers} sub={`${children} child · ${parents} parent`} />
          <Kpi label="New this week" value={new7d} accent="brand" />
          <Kpi label="Active 7d" value={active7d} sub={`${active24h} today`} accent="correct" />
          <Kpi label="Quizzes 7d" value={quizzes7d} sub={avgScore != null ? `avg ${Math.round(avgScore)}%` : undefined} />
        </div>
      </div>

      {/* Content health */}
      <div>
        <h2 className="font-heading text-sm font-semibold text-muted uppercase tracking-wide mb-2">Content</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Published questions" value={publishedQ} accent="correct" />
          <Kpi label="Staged" value={stagedQ} sub="awaiting gate" />
          <Kpi label="Flagged" value={flaggedQ} accent={flaggedQ > 0 ? 'red' : undefined} />
          <Kpi label="Topics live" value={publishedTopics} sub={`${topicsHealthPct}% of ${totalTopics}`} accent="brand" />
        </div>
      </div>

      {/* Per-subject question counts */}
      {qCountBySubject.size > 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
          <h2 className="font-heading text-base font-bold text-ink mb-3 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-brand" aria-hidden /> Published questions by subject
          </h2>
          <div className="space-y-2">
            {Array.from(qCountBySubject.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => {
                const pct = Math.round((count / publishedQ) * 100)
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-28 flex-none truncate text-xs text-muted">{name}</span>
                    <div className="flex-1 h-4 rounded-full bg-black/[0.05] overflow-hidden">
                      <div className="h-full rounded-full bg-brand/60" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 flex-none text-right text-xs font-semibold text-ink">{count.toLocaleString()}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Subscriptions */}
      {subscriptions > 0 && (
        <div>
          <h2 className="font-heading text-sm font-semibold text-muted uppercase tracking-wide mb-2">Subscriptions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Active subs" value={subscriptions} accent="brand" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div>
        <h2 className="font-heading text-sm font-semibold text-muted uppercase tracking-wide mb-2">Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NavCard
            href="/dashboard/admin/engagement"
            icon={<TrendingUp className="w-5 h-5" aria-hidden />}
            title="Engagement"
            desc="Activation funnel, per-child status, re-engagement emails"
          />
          <NavCard
            href="/dashboard/admin/users"
            icon={<Users className="w-5 h-5" aria-hidden />}
            title="Users & Activity"
            desc="Registrations, engagement, member list, delete accounts"
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
            href="/dashboard/admin/calibration"
            icon={<TrendingUp className="w-5 h-5" aria-hidden />}
            title="Difficulty Calibration"
            desc="Questions flagged as too hard or too easy"
          />
          <NavCard
            href="/dashboard/admin/vault"
            icon={<Gift className="w-5 h-5" aria-hidden />}
            title="Reward Vault"
            desc="Reward requests, fulfilment and catalogue"
            badge={pendingVaultRequests > 0 ? pendingVaultRequests : undefined}
            brand
          />
        </div>
      </div>

      {/* Quick links to other dashboards */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href="/dashboard/parent" className="text-xs text-muted hover:text-ink underline underline-offset-2">
          Parent dashboard →
        </Link>
        <Link href="/dashboard/child" className="text-xs text-muted hover:text-ink underline underline-offset-2">
          Child dashboard →
        </Link>
      </div>
    </section>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number
  sub?: string
  accent?: 'brand' | 'correct' | 'red'
}) {
  const colour =
    accent === 'brand' ? 'text-brand' :
    accent === 'correct' ? 'text-correct' :
    accent === 'red' ? 'text-incorrect' :
    'text-ink'
  return (
    <div className="rounded-xl border border-black/5 bg-surface px-3 py-3 shadow-sm">
      <p className={`font-heading text-xl font-bold ${colour}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-muted">{label}</p>
      {sub && <p className="text-[11px] text-muted/70 mt-0.5">{sub}</p>}
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
