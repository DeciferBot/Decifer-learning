// Admin → Users & Activity.
// Tracks current users, new registrations, and engagement for app management.
// Admin-only: middleware gates /dashboard/admin/*, and requireAdmin() re-checks
// the role against the profiles table before any data is read.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { Users, TrendingUp, Clock, GraduationCap } from '@/components/ui/icons'
import { UsersTable, type UserRow } from './UsersTable'

export const metadata = { title: 'Users & Activity — Admin' }
export const revalidate = 60

const DAY = 86_400_000

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

// "5m ago" / "3h ago" / "2d ago" / "—"
function relativeTime(date: Date | null, now: number): string {
  if (!date) return '—'
  const diff = now - date.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`
  const days = Math.floor(diff / DAY)
  if (days < 30) return `${days}d ago`
  return dateFmt.format(date)
}

const YEAR_ORDER: string[] = MVP_YEAR_GROUPS.map((y) => y.label)
const YEAR_DISPLAY = Object.fromEntries(MVP_YEAR_GROUPS.map((y) => [y.label, y.display]))

export default async function AdminUsersPage() {
  await requireAdmin()

  const now = Date.now()
  const today = startOfUTCDay(new Date(now))
  const ago7 = new Date(now - 7 * DAY)
  const ago30 = new Date(now - 30 * DAY)
  const ago24h = new Date(now - DAY)

  const [profiles, quizAttempts7d, scoreAgg7d, totalPublishedQ, pointsAgg] = await Promise.all([
    prisma.profile.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        user_id: true,
        display_name: true,
        role: true,
        total_points: true,
        streak_days: true,
        last_active: true,
        created_at: true,
        year_group: { select: { label: true } },
        family_as_child: { select: { parent: { select: { display_name: true } } } },
        _count: { select: { family_as_parent: true } },
      },
    }),
    prisma.quizAttempt.count({ where: { created_at: { gte: ago7 } } }),
    prisma.quizAttempt.aggregate({ where: { created_at: { gte: ago7 } }, _avg: { score: true } }),
    prisma.quizQuestion.count({ where: { status: 'published' } }),
    prisma.pointEvent.aggregate({ where: { created_at: { gte: ago7 } }, _sum: { amount: true } }),
  ])

  // Enrich with auth email + last sign-in (auth.users is the source of truth for
  // registration). Best-effort — page still renders if the admin API is slow.
  const emailByUserId = new Map<string, string>()
  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data?.users ?? []) {
      if (u.email) emailByUserId.set(u.id, u.email)
    }
  } catch {
    // Email enrichment is optional; ignore failures.
  }

  // ── Headline counts ──
  const totalUsers = profiles.length
  const children = profiles.filter((p) => p.role === 'child').length
  const parents = profiles.filter((p) => p.role === 'parent').length
  const admins = profiles.filter((p) => p.role === 'admin').length

  const newToday = profiles.filter((p) => p.created_at >= today).length
  const new7d = profiles.filter((p) => p.created_at >= ago7).length
  const new30d = profiles.filter((p) => p.created_at >= ago30).length

  const active24h = profiles.filter((p) => p.last_active && p.last_active >= ago24h).length
  const active7d = profiles.filter((p) => p.last_active && p.last_active >= ago7).length

  const avgScore7d = scoreAgg7d._avg.score
  const pointsAwarded7d = pointsAgg._sum.amount ?? 0

  // ── Registration trend: last 14 days (UTC) ──
  const trend: { key: string; label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY)
    trend.push({ key: ymd(d), label: dayMonthFmt.format(d), count: 0 })
  }
  const trendIndex = new Map(trend.map((t, i) => [t.key, i]))
  for (const p of profiles) {
    const idx = trendIndex.get(ymd(startOfUTCDay(p.created_at)))
    if (idx !== undefined) trend[idx].count++
  }
  const trendMax = Math.max(1, ...trend.map((t) => t.count))

  // ── Year-group distribution (children only) ──
  const ygCounts = new Map<string, number>()
  for (const p of profiles) {
    if (p.role !== 'child') continue
    const label = p.year_group?.label ?? 'unassigned'
    ygCounts.set(label, (ygCounts.get(label) ?? 0) + 1)
  }
  const yearDist = Array.from(ygCounts.entries())
    .map(([label, count]) => ({
      label,
      display: YEAR_DISPLAY[label] ?? 'Unassigned',
      count,
    }))
    .sort((a, b) => YEAR_ORDER.indexOf(a.label) - YEAR_ORDER.indexOf(b.label))
  const yearMax = Math.max(1, ...yearDist.map((y) => y.count))

  // ── Rows for the table ──
  const rows: UserRow[] = profiles.map((p) => {
    let relation = '—'
    if (p.role === 'child') {
      const parentName = p.family_as_child[0]?.parent?.display_name
      relation = parentName ? `Parent: ${parentName}` : 'No parent linked'
    } else if (p.role === 'parent') {
      const n = p._count.family_as_parent
      relation = n === 0 ? 'No children linked' : `${n} child${n === 1 ? '' : 'ren'}`
    }
    return {
      id: p.id,
      userId: p.user_id,
      name: p.display_name,
      email: emailByUserId.get(p.user_id) ?? null,
      role: p.role,
      yearGroup: p.year_group ? (YEAR_DISPLAY[p.year_group.label] ?? p.year_group.label) : null,
      points: p.total_points,
      streak: p.streak_days,
      lastActive: relativeTime(p.last_active, now),
      lastActiveTs: p.last_active ? p.last_active.getTime() : 0,
      joined: dateFmt.format(p.created_at),
      joinedTs: p.created_at.getTime(),
      relation,
    }
  })

  return (
    <section className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="font-heading text-2xl font-bold text-ink flex items-center gap-2">
          <Users className="w-6 h-6 text-brand" aria-hidden /> Users &amp; Activity
        </h1>
        <Link href="/dashboard/admin" className="text-sm text-muted hover:text-ink">
          ← Admin
        </Link>
      </div>

      {/* ── Headline KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total users" value={totalUsers} sub={`${children} child · ${parents} parent`} />
        <KpiCard label="New this week" value={new7d} sub={`${newToday} today · ${new30d} in 30d`} accent="brand" />
        <KpiCard label="Active 7d" value={active7d} sub={`${active24h} in last 24h`} accent="correct" />
        <KpiCard label="Quizzes 7d" value={quizAttempts7d} sub={avgScore7d != null ? `avg ${Math.round(avgScore7d)}%` : 'no attempts'} />
      </div>

      {/* ── Registration trend ── */}
      <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold text-ink flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-brand" aria-hidden /> Registrations · last 14 days
          </h2>
          <span className="text-xs text-muted">{new30d} in 30d</span>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {trend.map((t) => (
            <div key={t.key} className="flex-1 flex flex-col items-center justify-end gap-1 group">
              <span className="text-[10px] font-semibold text-ink opacity-0 group-hover:opacity-100 transition-opacity">
                {t.count > 0 ? t.count : ''}
              </span>
              <div
                className={`w-full rounded-t ${t.count > 0 ? 'bg-brand' : 'bg-black/[0.06]'}`}
                style={{ height: `${Math.max(4, (t.count / trendMax) * 100)}%` }}
                title={`${t.label}: ${t.count} registration${t.count === 1 ? '' : 's'}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted">
          <span>{trend[0]?.label}</span>
          <span>{trend[trend.length - 1]?.label}</span>
        </div>
      </div>

      {/* ── Secondary stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MiniStat icon={<Clock className="w-4 h-4" aria-hidden />} label="Points awarded 7d" value={pointsAwarded7d.toLocaleString()} />
        <MiniStat icon={<GraduationCap className="w-4 h-4" aria-hidden />} label="Published questions" value={totalPublishedQ.toLocaleString()} />
        <MiniStat icon={<Users className="w-4 h-4" aria-hidden />} label="Admins" value={admins.toString()} />
      </div>

      {/* ── Year-group distribution (children) ── */}
      {yearDist.length > 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
          <h2 className="font-heading text-base font-bold text-ink mb-3">Children by year group</h2>
          <div className="space-y-2">
            {yearDist.map((y) => (
              <div key={y.label} className="flex items-center gap-3">
                <span className="w-20 flex-none text-xs text-muted">{y.display}</span>
                <div className="flex-1 h-5 rounded-full bg-black/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand/70"
                    style={{ width: `${(y.count / yearMax) * 100}%` }}
                  />
                </div>
                <span className="w-6 flex-none text-right text-xs font-semibold text-ink">{y.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full user table (search + filter) ── */}
      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold text-ink">All users ({totalUsers})</h2>
        <UsersTable rows={rows} />
      </div>
    </section>
  )
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number
  sub?: string
  accent?: 'brand' | 'correct'
}) {
  const valueColour = accent === 'brand' ? 'text-brand' : accent === 'correct' ? 'text-correct' : 'text-ink'
  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
      <p className={`font-heading text-2xl font-bold ${valueColour}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted mt-1">{sub}</p>}
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
      <span className="flex-none text-brand">{icon}</span>
      <div className="min-w-0">
        <p className="font-heading text-lg font-bold text-ink leading-none">{value}</p>
        <p className="text-[11px] text-muted mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}
