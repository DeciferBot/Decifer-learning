// Admin → Engagement. Replaces ad-hoc usage readouts with a standing view:
// activation funnel, per-child status, duplicate detection, and the state of
// the automated re-engagement emails. All figures are computed live from the DB.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import { Users, TrendingUp, AlertTriangle, Flame, Bell, Sparkles, ScrollText } from '@/components/ui/icons'

export const metadata = { title: 'Engagement — Decifer Admin' }
export const revalidate = 30

const DAY = 86_400_000
const ACTIVE_WINDOW = 7 * DAY     // "weekly active"
const DORMANT_WINDOW = 7 * DAY    // played, but nothing in over a week
const STRUGGLE_SCORE = 0.55       // avg score below this (with enough attempts) = needs help

type Status = 'active' | 'dormant' | 'struggling' | 'never'

function yearLabel(label: string | null | undefined): string {
  if (!label) return '—'
  return label.replace(/^year-/, 'Y')
}

export default async function AdminEngagementPage() {
  await requireAdmin()

  const now = Date.now()

  const [children, scoreAgg, completedAgg, emailSums, parentsWithKids] = await Promise.all([
    prisma.profile.findMany({
      where: { role: 'child' },
      select: {
        id: true,
        display_name: true,
        streak_days: true,
        last_active: true,
        activation_email_count: true,
        comeback_email_count: true,
        year_group: { select: { label: true } },
        family_as_child: { select: { parent_user_id: true }, take: 1 },
        _count: { select: { quiz_attempts: true } },
      },
    }),
    prisma.quizAttempt.groupBy({ by: ['profile_id'], _avg: { score: true } }),
    prisma.topicProgress.groupBy({ by: ['profile_id'], where: { status: 'completed' }, _count: { _all: true } }),
    prisma.profile.aggregate({
      where: { role: 'child' },
      _sum: { activation_email_count: true, comeback_email_count: true },
    }),
    prisma.familyLink.findMany({ select: { parent_user_id: true } }),
  ])

  const avgByChild = new Map(scoreAgg.map((r) => [r.profile_id, r._avg.score ?? null]))
  const completedByChild = new Map(completedAgg.map((r) => [r.profile_id, r._count._all]))

  const rows = children
    .map((c) => {
      const attempts = c._count.quiz_attempts
      const avg = avgByChild.get(c.id) ?? null
      const idleMs = c.last_active ? now - c.last_active.getTime() : Infinity
      let status: Status
      if (attempts === 0) status = 'never'
      else if (idleMs >= DORMANT_WINDOW) status = 'dormant'
      else if (avg !== null && avg < STRUGGLE_SCORE && attempts >= 5) status = 'struggling'
      else status = 'active'
      return {
        id: c.id,
        name: c.display_name,
        year: yearLabel(c.year_group?.label),
        attempts,
        avgPct: avg !== null ? Math.round(avg * 100) : null,
        streak: c.streak_days,
        topics: completedByChild.get(c.id) ?? 0,
        hasParent: c.family_as_child.length > 0,
        status,
      }
    })
    .sort((a, b) => b.attempts - a.attempts || b.streak - a.streak)

  // Headline metrics
  const total = children.length
  const played = children.filter((c) => c._count.quiz_attempts > 0).length
  const loggedIn = children.filter((c) => c.last_active !== null).length
  const completedTopic = children.filter((c) => (completedByChild.get(c.id) ?? 0) > 0).length
  const wau = children.filter((c) => c.last_active && now - c.last_active.getTime() < ACTIVE_WINDOW).length
  const neverPlayed = total - played
  const dormant = rows.filter((r) => r.status === 'dormant').length
  const struggling = rows.filter((r) => r.status === 'struggling').length
  const activationPct = total > 0 ? Math.round((played / total) * 100) : 0

  // Duplicate detection — children sharing a display name (case-insensitive)
  const nameGroups = new Map<string, string[]>()
  for (const c of children) {
    const key = c.display_name.trim().toLowerCase()
    nameGroups.set(key, [...(nameGroups.get(key) ?? []), c.display_name])
  }
  const duplicates = Array.from(nameGroups.values()).filter((g) => g.length > 1)

  const uniqueParents = new Set(parentsWithKids.map((p) => p.parent_user_id)).size
  const activationSent = emailSums._sum.activation_email_count ?? 0
  const comebackSent = emailSums._sum.comeback_email_count ?? 0

  const funnel = [
    { label: 'Registered', value: total, colour: 'bg-explorer' },
    { label: 'Logged in', value: loggedIn, colour: 'bg-science' },
    { label: 'Played a quiz', value: played, colour: 'bg-lightning' },
    { label: 'Completed a topic', value: completedTopic, colour: 'bg-brand' },
  ]

  return (
    <section className="space-y-6 pb-10">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-brand" aria-hidden /> Engagement
        </h1>
        <p className="text-sm text-muted mt-0.5">Who&apos;s active, who&apos;s slipping, and what the nudges are doing.</p>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Weekly active kids" value={`${wau}`} sub={`of ${total}`} icon={<Flame className="w-4 h-4" aria-hidden />} accent="correct" />
        <Kpi label="Activation" value={`${activationPct}%`} sub={`${played} ever played`} accent={activationPct < 60 ? 'yellow' : 'correct'} />
        <Kpi label="At risk" value={`${dormant + struggling}`} sub={`${dormant} dormant · ${struggling} struggling`} accent={dormant + struggling > 0 ? 'red' : undefined} />
        <Kpi label="Never played" value={`${neverPlayed}`} sub="signed up, no quiz" accent={neverPlayed > 0 ? 'yellow' : undefined} />
      </div>

      {/* Funnel */}
      <Panel title="Activation funnel" icon={<Users className="w-4 h-4 text-brand" aria-hidden />}>
        <div className="space-y-2">
          {funnel.map((f) => {
            const pct = total > 0 ? Math.round((f.value / total) * 100) : 0
            return (
              <div key={f.label} className="flex items-center gap-3">
                <span className="w-32 flex-none text-xs text-muted">{f.label}</span>
                <div className="flex-1 h-5 rounded-full bg-black/[0.05] overflow-hidden">
                  <div className={`h-full rounded-full ${f.colour}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                </div>
                <span className="w-16 flex-none text-right text-xs font-semibold text-ink">
                  {f.value} <span className="text-muted font-normal">{pct}%</span>
                </span>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Per-child table */}
      <Panel title="Per child" icon={<Users className="w-4 h-4 text-brand" aria-hidden />}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="font-medium py-1.5 px-1">Child</th>
                <th className="font-medium py-1.5 px-1">Attempts</th>
                <th className="font-medium py-1.5 px-1">Avg</th>
                <th className="font-medium py-1.5 px-1">Topics</th>
                <th className="font-medium py-1.5 px-1">Streak</th>
                <th className="font-medium py-1.5 px-1">Parent</th>
                <th className="font-medium py-1.5 px-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-black/5">
                  <td className="py-2 px-1 text-ink">
                    {r.name} <span className="text-muted text-xs">{r.year}</span>
                  </td>
                  <td className="py-2 px-1 text-ink">{r.attempts}</td>
                  <td className="py-2 px-1 text-ink">{r.avgPct !== null ? `${r.avgPct}%` : '—'}</td>
                  <td className="py-2 px-1 text-ink">{r.topics}</td>
                  <td className="py-2 px-1 text-ink">{r.streak > 0 ? r.streak : '—'}</td>
                  <td className="py-2 px-1">
                    {r.hasParent
                      ? <span className="text-correct text-xs">Linked</span>
                      : <span className="text-lightning text-xs">None</span>}
                  </td>
                  <td className="py-2 px-1"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Duplicates */}
      <Panel
        title={`Duplicate accounts${duplicates.length ? ` (${duplicates.length})` : ''}`}
        icon={<AlertTriangle className={`w-4 h-4 ${duplicates.length ? 'text-incorrect' : 'text-muted'}`} aria-hidden />}
      >
        {duplicates.length === 0 ? (
          <p className="text-sm text-muted">No children share a name — nothing to merge.</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-ink">
            {duplicates.map((g, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="font-medium">{g[0]}</span>
                <span className="text-xs text-incorrect">×{g.length} accounts — review &amp; merge</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Automated emails */}
      <Panel title="Automated emails" icon={<Bell className="w-4 h-4 text-brand" aria-hidden />}>
        <div className="space-y-2">
          <EmailRow
            icon={<Sparkles className="w-4 h-4 text-explorer" aria-hidden />}
            title="Activation nudge — kids who never played"
            desc="Parent if linked, else the child · every 3 days, max 3"
            stat={`${neverPlayed} eligible · ${activationSent} sent`}
          />
          <EmailRow
            icon={<Bell className="w-4 h-4 text-lightning" aria-hidden />}
            title="Come-back reminder — kids gone idle"
            desc="Parent if linked, else the child · after 7 days idle"
            stat={`${dormant} eligible · ${comebackSent} sent`}
          />
          <EmailRow
            icon={<ScrollText className="w-4 h-4 text-correct" aria-hidden />}
            title="Parent report card — weekly progress"
            desc="Every Monday · per-child stats, weak areas, next steps"
            stat={`${uniqueParents} parents`}
          />
        </div>
        <p className="text-[11px] text-muted/70 mt-3">
          Runs via Vercel Cron (engagement-nudge daily 17:00 UTC, weekly-digest Mondays 07:00 UTC). Sends require RESEND_API_KEY.
        </p>
      </Panel>

      <div className="pt-1">
        <Link href="/dashboard/admin" className="text-xs text-muted hover:text-ink underline underline-offset-2">
          ← Back to admin
        </Link>
      </div>
    </section>
  )
}

function Kpi({
  label, value, sub, accent, icon,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'correct' | 'red' | 'yellow'
  icon?: React.ReactNode
}) {
  const colour =
    accent === 'correct' ? 'text-correct' :
    accent === 'red' ? 'text-incorrect' :
    accent === 'yellow' ? 'text-lightning' :
    'text-ink'
  return (
    <div className="rounded-xl border border-black/5 bg-surface px-3 py-3 shadow-sm">
      <p className={`font-heading text-xl font-bold ${colour} flex items-center gap-1.5`}>
        {icon && <span className={colour}>{icon}</span>}{value}
      </p>
      <p className="text-xs text-muted">{label}</p>
      {sub && <p className="text-[11px] text-muted/70 mt-0.5">{sub}</p>}
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
      <h2 className="font-heading text-base font-bold text-ink mb-3 flex items-center gap-1.5">
        {icon} {title}
      </h2>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    active:     { label: 'Active',     cls: 'bg-correct/10 text-correct' },
    dormant:    { label: 'Dormant',    cls: 'bg-incorrect/10 text-incorrect' },
    struggling: { label: 'Struggling', cls: 'bg-lightning/15 text-lightning' },
    never:      { label: 'Never played', cls: 'bg-black/[0.05] text-muted' },
  }
  const s = map[status]
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

function EmailRow({ icon, title, desc, stat }: { icon: React.ReactNode; title: string; desc: string; stat: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 px-3 py-2.5">
      <span className="flex-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{title}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
      <span className="flex-none text-xs font-medium text-muted text-right">{stat}</span>
    </div>
  )
}
