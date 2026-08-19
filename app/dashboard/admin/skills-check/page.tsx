// Admin → Skills Check. The funnel for the free public check at /skills-check:
// how many attempts start, how many finish, how many parents leave an email, and
// where each published check is landing children.
//
// Read-only on purpose. Publishing a check and deleting a lead both happen
// elsewhere; this page only shows what is already true.
//
// PRIVACY: a skill_check_attempt holds no personal data by design, so there is no
// child name, age or school to show here and none is invented. The only personal
// field in the feature is the parent's email, and a deleted lead is a tombstone
// (parent_email set to '') which renders as "deleted", never as a blank cell.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import type { SkillCheckWorkingLevel } from '@prisma/client'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'
import type { StrandResult } from '@/lib/skills-check/score'
import { ClipboardList, Users, ScrollText, AlertTriangle, Target, Clock } from '@/components/ui/icons'

export const metadata = { title: 'Skills Check · Admin' }
export const revalidate = 30

/** Rows shown in the long tables. Anything beyond this is counted, not listed. */
const RECENT_ATTEMPTS = 25
const RECENT_LEADS = 50
const WORST_ITEMS = 30

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

const LEVEL_ORDER = [
  'below_year', 'towards_year', 'within_year', 'secure_year', 'secure_ready_to_stretch',
] as const satisfies readonly SkillCheckWorkingLevel[]

const LEVEL_LABEL: Record<SkillCheckWorkingLevel, string> = {
  below_year: 'Below year',
  towards_year: 'Towards year',
  within_year: 'Within year',
  secure_year: 'Secure',
  secure_ready_to_stretch: 'Secure + stretch',
}

const LEVEL_BAR: Record<SkillCheckWorkingLevel, string> = {
  below_year: 'bg-incorrect',
  towards_year: 'bg-lightning',
  within_year: 'bg-explorer',
  secure_year: 'bg-correct',
  secure_ready_to_stretch: 'bg-brand',
}

/** Percentage, or null when the denominator is zero. Never returns NaN. */
function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

function pct(value: number | null): string {
  return value === null ? '–' : `${value}%`
}

function yearShort(label: string): string {
  return label.replace(/^year-/, 'Y')
}

export default async function AdminSkillsCheckPage() {
  await requireAdmin()

  const [checks, attemptAgg, levelAgg, leadAgg, deletedLeads, recentAttempts, recentLeads, answerAgg] =
    await Promise.all([
      // Every check, published or not. An unpublished check with attempts would
      // itself be worth seeing, so this is not filtered.
      prisma.skillCheck.findMany({
        select: {
          id: true,
          slug: true,
          is_published: true,
          item_count: true,
          subject: { select: { name: true } },
          year_group: { select: { label: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ subject: { name: 'asc' } }, { year_group: { label: 'asc' } }],
      }),

      // Started, finished and pooled score per check, in one pass.
      // _count.finished_at counts non-null values, so it is the finished count.
      prisma.skillCheckAttempt.groupBy({
        by: ['check_id'],
        _count: { _all: true, finished_at: true },
        _sum: { raw_score: true, total_items: true },
      }),

      // The spread of working levels across finished attempts.
      prisma.skillCheckAttempt.groupBy({
        by: ['check_id', 'working_level'],
        where: { finished_at: { not: null } },
        _count: { _all: true },
      }),

      // Attempts that captured a live (not deleted) parent email.
      prisma.skillCheckAttempt.groupBy({
        by: ['check_id'],
        where: { lead: { is: { deleted_at: null } } },
        _count: { _all: true },
      }),

      prisma.skillCheckLead.count({ where: { deleted_at: { not: null } } }),

      prisma.skillCheckAttempt.findMany({
        where: { finished_at: { not: null } },
        orderBy: { finished_at: 'desc' },
        take: RECENT_ATTEMPTS,
        select: {
          id: true,
          finished_at: true,
          raw_score: true,
          total_items: true,
          working_level: true,
          strand_results: true,
          check: { select: { slug: true } },
          lead: { select: { deleted_at: true } },
        },
      }),

      prisma.skillCheckLead.findMany({
        orderBy: { consented_at: 'desc' },
        take: RECENT_LEADS,
        select: {
          id: true,
          parent_email: true,
          consented_at: true,
          verified_at: true,
          deleted_at: true,
          source: true,
          attempt: { select: { check: { select: { slug: true } } } },
        },
      }),

      // Per-item correct rate. Two rows per item at most (was_correct true/false),
      // folded below, so this is one query for the whole section.
      prisma.skillCheckAnswer.groupBy({
        by: ['item_id', 'was_correct'],
        _count: { _all: true },
      }),
    ])

  // ── Fold the aggregates onto the checks ────────────────────────────────────
  const startedByCheck = new Map(attemptAgg.map((r) => [r.check_id, r._count._all]))
  const finishedByCheck = new Map(attemptAgg.map((r) => [r.check_id, r._count.finished_at]))
  const rawByCheck = new Map(attemptAgg.map((r) => [r.check_id, r._sum.raw_score ?? 0]))
  const itemsAnsweredByCheck = new Map(attemptAgg.map((r) => [r.check_id, r._sum.total_items ?? 0]))
  const leadsByCheck = new Map(leadAgg.map((r) => [r.check_id, r._count._all]))

  const levelsByCheck = new Map<string, Partial<Record<SkillCheckWorkingLevel, number>>>()
  for (const row of levelAgg) {
    if (!row.working_level) continue
    const entry = levelsByCheck.get(row.check_id) ?? {}
    entry[row.working_level] = (entry[row.working_level] ?? 0) + row._count._all
    levelsByCheck.set(row.check_id, entry)
  }

  const checkRows = checks.map((c) => {
    const started = startedByCheck.get(c.id) ?? 0
    const finished = finishedByCheck.get(c.id) ?? 0
    const answered = itemsAnsweredByCheck.get(c.id) ?? 0
    return {
      id: c.id,
      slug: c.slug,
      subject: c.subject.name,
      year: yearShort(c.year_group.label),
      published: c.is_published,
      // Configured length vs. what is actually wired up. A gap here means the
      // check would serve short.
      items: c._count.items,
      expectedItems: c.item_count,
      started,
      finished,
      completion: rate(finished, started),
      emails: leadsByCheck.get(c.id) ?? 0,
      // Pooled: total marks earned over total items answered, so a short attempt
      // does not weigh the same as a full one.
      avgScore: rate(rawByCheck.get(c.id) ?? 0, answered),
      levels: levelsByCheck.get(c.id) ?? {},
    }
  })

  // ── Overall funnel ─────────────────────────────────────────────────────────
  const started = checkRows.reduce((n, r) => n + r.started, 0)
  const finished = checkRows.reduce((n, r) => n + r.finished, 0)
  const emails = checkRows.reduce((n, r) => n + r.emails, 0)
  const publishedChecks = checkRows.filter((r) => r.published).length

  const funnel = [
    { label: 'Attempts started', value: started, colour: 'bg-explorer', step: null as string | null },
    { label: 'Attempts finished', value: finished, colour: 'bg-science', step: `${pct(rate(finished, started))} of started` },
    { label: 'Emails captured', value: emails, colour: 'bg-brand', step: `${pct(rate(emails, finished))} of finished` },
  ]

  // ── Item difficulty ────────────────────────────────────────────────────────
  const itemStats = new Map<string, { correct: number; total: number }>()
  for (const row of answerAgg) {
    const s = itemStats.get(row.item_id) ?? { correct: 0, total: 0 }
    s.total += row._count._all
    if (row.was_correct) s.correct += row._count._all
    itemStats.set(row.item_id, s)
  }

  const answeredItems = itemStats.size > 0
    ? await prisma.skillCheckItem.findMany({
        where: { id: { in: [...itemStats.keys()] } },
        select: {
          id: true,
          position: true,
          band: true,
          check: { select: { slug: true } },
          strand: { select: { title: true } },
          question: { select: { question_text: true, status: true } },
        },
      })
    : []

  const itemRows = answeredItems
    .map((i) => {
      const s = itemStats.get(i.id) ?? { correct: 0, total: 0 }
      return {
        id: i.id,
        slug: i.check.slug,
        position: i.position,
        band: i.band,
        strand: i.strand.title,
        text: i.question.question_text,
        retired: i.question.status !== 'published',
        correct: s.correct,
        total: s.total,
        // total is at least 1 here: an item only appears if it has answers.
        rate: Math.round((s.correct / s.total) * 100),
      }
    })
    .sort((a, b) => a.rate - b.rate || b.total - a.total)

  const shownItems = itemRows.slice(0, WORST_ITEMS)

  return (
    <section className="space-y-6 pb-10">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-brand-700" aria-hidden /> Skills Check
        </h1>
        <p className="text-sm text-muted mt-0.5">
          The free public check at <code className="text-xs">/skills-check</code>: who starts it, who finishes it, and who leaves an email.
        </p>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Attempts started" value={`${started}`} sub={started === 0 ? 'nothing yet' : undefined} />
        <Kpi
          label="Finished"
          value={`${finished}`}
          sub={`${pct(rate(finished, started))} of started`}
          accent="correct"
        />
        <Kpi
          label="Emails captured"
          value={`${emails}`}
          sub={`${pct(rate(emails, finished))} of finished`}
          accent="brand"
        />
        <Kpi
          label="Published checks"
          value={`${publishedChecks}`}
          sub={`of ${checkRows.length} built`}
          accent={publishedChecks === 0 ? 'yellow' : undefined}
        />
      </div>

      {/* Funnel */}
      <Panel title="Funnel" icon={<Users className="w-4 h-4 text-brand-700" aria-hidden />}>
        {started === 0 ? (
          <p className="text-sm text-muted">
            No attempts yet. The funnel fills in as soon as someone starts a check.
          </p>
        ) : (
          <div className="space-y-2">
            {funnel.map((f) => {
              const share = rate(f.value, started) ?? 0
              return (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="w-28 flex-none text-xs text-muted">{f.label}</span>
                  <div className="flex-1 h-5 rounded-full bg-black/[0.05] overflow-hidden">
                    <div className={`h-full rounded-full ${f.colour}`} style={{ width: `${Math.max(share, 4)}%` }} />
                  </div>
                  <span className="w-20 flex-none text-right text-xs font-semibold text-ink">
                    {f.value} <span className="text-muted font-normal">{share}%</span>
                  </span>
                </div>
              )
            })}
            <p className="text-[11px] text-muted/70 pt-1">
              Start → finish {pct(rate(finished, started))} · finish → email {pct(rate(emails, finished))} · start → email {pct(rate(emails, started))}.
              Deleted leads ({deletedLeads}) are not counted as captured.
            </p>
          </div>
        )}
      </Panel>

      {/* Per check */}
      <Panel title="Per check" icon={<Target className="w-4 h-4 text-brand-700" aria-hidden />}>
        {checkRows.length === 0 ? (
          <p className="text-sm text-muted">No checks have been built yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="font-medium py-1.5 px-1">Check</th>
                    <th className="font-medium py-1.5 px-1">Live</th>
                    <th className="font-medium py-1.5 px-1">Items</th>
                    <th className="font-medium py-1.5 px-1">Started</th>
                    <th className="font-medium py-1.5 px-1">Finished</th>
                    <th className="font-medium py-1.5 px-1">Emails</th>
                    <th className="font-medium py-1.5 px-1">Avg</th>
                    <th className="font-medium py-1.5 px-1">Working level</th>
                  </tr>
                </thead>
                <tbody>
                  {checkRows.map((r) => (
                    <tr key={r.id} className="border-t border-black/5 align-top">
                      <td className="py-2 px-1 text-ink">
                        {r.slug}
                        <span className="block text-[11px] text-muted">{r.subject} · {r.year}</span>
                      </td>
                      <td className="py-2 px-1">
                        {r.published
                          ? <span className="text-correct-700 text-xs">Published</span>
                          : <span className="text-muted text-xs">Draft</span>}
                      </td>
                      <td className="py-2 px-1 text-ink">
                        {r.items}
                        {r.items !== r.expectedItems && (
                          <span className="block text-[11px] text-incorrect-700">wants {r.expectedItems}</span>
                        )}
                      </td>
                      <td className="py-2 px-1 text-ink">{r.started}</td>
                      <td className="py-2 px-1 text-ink">
                        {r.finished}
                        <span className="block text-[11px] text-muted">{pct(r.completion)}</span>
                      </td>
                      <td className="py-2 px-1 text-ink">{r.emails}</td>
                      <td className="py-2 px-1 text-ink">{pct(r.avgScore)}</td>
                      <td className="py-2 px-1 min-w-[150px]"><LevelSpread levels={r.levels} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-3">
              {LEVEL_ORDER.map((l) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${LEVEL_BAR[l]}`} aria-hidden />
                  {LEVEL_LABEL[l]}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted/70 mt-2">
              Everyone landing on the same level usually means the check is pitched wrong, not that the children are.
            </p>
          </>
        )}
      </Panel>

      {/* Recent attempts */}
      <Panel title="Recent attempts" icon={<Clock className="w-4 h-4 text-brand-700" aria-hidden />}>
        {recentAttempts.length === 0 ? (
          <p className="text-sm text-muted">No finished attempts yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="font-medium py-1.5 px-1">Finished</th>
                    <th className="font-medium py-1.5 px-1">Check</th>
                    <th className="font-medium py-1.5 px-1">Score</th>
                    <th className="font-medium py-1.5 px-1">Working level</th>
                    <th className="font-medium py-1.5 px-1">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttempts.map((a) => {
                    // Typed loosely by Prisma as Json; the only writer is
                    // scoreCheck(), same cast as lib/skills-check/server.ts.
                    const strands = (a.strand_results as unknown as StrandResult[] | null) ?? []
                    return (
                      <tr key={a.id} className="border-t border-black/5">
                        <td className="py-2 px-1 text-ink whitespace-nowrap">
                          {a.finished_at ? dateTimeFmt.format(a.finished_at) : '–'}
                        </td>
                        <td className="py-2 px-1 text-ink">{a.check.slug}</td>
                        <td className="py-2 px-1 text-ink whitespace-nowrap">
                          {a.raw_score ?? 0}/{a.total_items ?? 0}
                          {strands.length > 0 && (
                            <span className="block text-[11px] text-muted">{strands.length} strands</span>
                          )}
                        </td>
                        <td className="py-2 px-1">
                          {a.working_level
                            ? <span className="text-xs text-ink">{LEVEL_LABEL[a.working_level]}</span>
                            : <span className="text-xs text-muted">–</span>}
                        </td>
                        <td className="py-2 px-1">
                          {!a.lead
                            ? <span className="text-xs text-muted">No</span>
                            : a.lead.deleted_at
                              ? <span className="text-xs text-incorrect-700">Deleted</span>
                              : <span className="text-xs text-correct-700">Captured</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted/70 mt-3">
              Newest {recentAttempts.length} of {finished}. An attempt records no child name, age or school, so there is nothing else to show.
            </p>
          </>
        )}
      </Panel>

      {/* Leads */}
      <Panel title="Leads" icon={<ScrollText className="w-4 h-4 text-brand-700" aria-hidden />}>
        {recentLeads.length === 0 ? (
          <p className="text-sm text-muted">No parent has left an email yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="font-medium py-1.5 px-1">Email</th>
                    <th className="font-medium py-1.5 px-1">Check</th>
                    <th className="font-medium py-1.5 px-1">Given</th>
                    <th className="font-medium py-1.5 px-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((l) => (
                    <tr key={l.id} className="border-t border-black/5">
                      <td className="py-2 px-1 break-all">
                        {/* A deleted lead is a tombstone with parent_email = ''.
                            Say so rather than rendering an empty cell. */}
                        {l.deleted_at
                          ? <span className="text-muted italic">deleted</span>
                          : <span className="text-ink">{l.parent_email}</span>}
                      </td>
                      <td className="py-2 px-1 text-ink">{l.attempt.check.slug}</td>
                      <td className="py-2 px-1 text-ink whitespace-nowrap">{dateTimeFmt.format(l.consented_at)}</td>
                      <td className="py-2 px-1 whitespace-nowrap">
                        {l.deleted_at
                          ? <span className="text-xs text-incorrect-700">Deleted {dateTimeFmt.format(l.deleted_at)}</span>
                          : l.verified_at
                            ? <span className="text-xs text-correct-700">Verified</span>
                            : <span className="text-xs text-muted">Unverified</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted/70 mt-3">
              Newest {recentLeads.length}. {emails} live · {deletedLeads} deleted on request. Deletion happens from the link in the report email, not from here.
            </p>
          </>
        )}
      </Panel>

      {/* Item difficulty */}
      <Panel
        title="Hardest items"
        icon={<AlertTriangle className={`w-4 h-4 ${shownItems.some((i) => i.rate === 0) ? 'text-incorrect-700' : 'text-muted'}`} aria-hidden />}
      >
        {shownItems.length === 0 ? (
          <p className="text-sm text-muted">
            No items have been answered yet, so there is no difficulty to report.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="font-medium py-1.5 px-1">Question</th>
                    <th className="font-medium py-1.5 px-1">Check</th>
                    <th className="font-medium py-1.5 px-1">Band</th>
                    <th className="font-medium py-1.5 px-1">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {shownItems.map((i) => (
                    <tr key={i.id} className="border-t border-black/5 align-top">
                      <td className="py-2 px-1 text-ink">
                        <span className="block max-w-[320px] truncate" title={i.text}>{i.text}</span>
                        <span className="block text-[11px] text-muted">
                          {i.strand}
                          {i.retired && <span className="text-incorrect-700"> · question no longer published</span>}
                        </span>
                      </td>
                      <td className="py-2 px-1 text-ink whitespace-nowrap">
                        {i.slug}
                        <span className="block text-[11px] text-muted">#{i.position}</span>
                      </td>
                      <td className="py-2 px-1 text-xs text-muted">{i.band}</td>
                      <td className="py-2 px-1 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${i.rate < 34 ? 'text-incorrect-700' : i.rate < 67 ? 'text-lightning' : 'text-correct-700'}`}>
                          {i.rate}%
                        </span>
                        <span className="block text-[11px] text-muted">{i.correct}/{i.total}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted/70 mt-3">
              Worst first. Showing {shownItems.length} of {itemRows.length} answered items.
              A near-zero rate on a live check usually means a broken question, not a hard one.
            </p>
          </>
        )}
      </Panel>

      <div className="pt-1">
        <Link href="/dashboard/admin" className="text-xs text-muted hover:text-ink underline underline-offset-2">
          ← Back to admin
        </Link>
      </div>
    </section>
  )
}

/** Stacked bar of working levels for one check. Empty when nobody finished. */
function LevelSpread({ levels }: { levels: Partial<Record<SkillCheckWorkingLevel, number>> }) {
  const total = LEVEL_ORDER.reduce((n, l) => n + (levels[l] ?? 0), 0)
  if (total === 0) return <span className="text-xs text-muted">–</span>
  return (
    <span className="block">
      <span className="flex h-4 w-full overflow-hidden rounded-full bg-black/[0.05]">
        {LEVEL_ORDER.map((l) => {
          const n = levels[l] ?? 0
          if (n === 0) return null
          return (
            <span
              key={l}
              className={LEVEL_BAR[l]}
              style={{ width: `${(n / total) * 100}%` }}
              title={`${LEVEL_LABEL[l]}: ${n}`}
            />
          )
        })}
      </span>
      <span className="block text-[11px] text-muted mt-0.5">
        {LEVEL_ORDER.filter((l) => (levels[l] ?? 0) > 0)
          .map((l) => `${LEVEL_LABEL[l]} ${levels[l]}`)
          .join(' · ')}
      </span>
    </span>
  )
}

function Kpi({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'correct' | 'brand' | 'red' | 'yellow'
}) {
  const colour =
    accent === 'correct' ? 'text-correct-700' :
    accent === 'brand' ? 'text-brand-700' :
    accent === 'red' ? 'text-incorrect-700' :
    accent === 'yellow' ? 'text-lightning' :
    'text-ink'
  return (
    <div className="rounded-xl border border-black/5 bg-surface px-3 py-3 shadow-sm">
      <p className={`font-heading text-xl font-bold ${colour}`}>{value}</p>
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
