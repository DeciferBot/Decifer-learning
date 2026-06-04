// Parent dashboard home — shows real child progress data from the DB.
// Prerequisite: Lesson Store activation gate must pass before this sprint.
// No fake data, no AI generation, no seed imports.

import Link from 'next/link'
import { buildParentActions } from '@/lib/parent-recommendations'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import {
  getLinkedChildren,
  getChildProgressSummary,
  getChildWeakAreas,
  getRecommendedNextLesson,
  getChildVaultSummary,
  getPendingVaultRequests,
  getChildWeeklyDigestSummary,
  getCurriculumProgress,
  type CurriculumSubject,
} from '@/lib/parent-dashboard'
import { LinkChildForm } from '@/components/parent/LinkChildForm'
import { CurriculumMap } from '@/components/parent/CurriculumMap'
import { Star, Flame, Gift, BarChart, Target, MapPin, CalendarDays, Check } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export const metadata = { title: 'Parent dashboard — Decifer Learning' }

const VAULT_STATUS_LABELS: Record<string, { label: string; colour: string; bg: string }> = {
  pending:         { label: 'Waiting for parent', colour: 'text-points-gold', bg: 'bg-points-gold/20' },
  deferred:        { label: 'Deferred',           colour: 'text-muted',       bg: 'bg-black/5'        },
  counter_offered: { label: 'Waiting for child',  colour: 'text-maths',       bg: 'bg-maths/15'       },
}

export default async function ParentDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const displayName = profile?.display_name ?? (user ? getUserDisplayName(user) : 'Parent')

  const children = profile ? await getLinkedChildren(profile.user_id) : []

  // Fetch per-child data in parallel
  // Need year_group_id for curriculum progress
  const childProfiles = await prisma.profile.findMany({
    where: { id: { in: children.map((c) => c.profileId) } },
    select: { id: true, year_group_id: true },
  })
  const yearGroupIdMap = new Map(childProfiles.map((p) => [p.id, p.year_group_id]))

  // Run per-child data + pending vault requests in parallel (both are independent)
  const [childData, pendingVaultRequests] = await Promise.all([
    Promise.all(
      children.map(async (child) => {
        const yearGroupId = yearGroupIdMap.get(child.profileId) ?? null
        const [progress, weakAreas, recommended, vault, digest, curriculum] = await Promise.all([
          getChildProgressSummary(child.profileId),
          getChildWeakAreas(child.profileId, 2),
          getRecommendedNextLesson(child.profileId, child.yearGroupLabel),
          getChildVaultSummary(child.profileId).catch(() => ({ creditBalance: 0, currentBand: 'none', pendingRequestCount: 0 })),
          getChildWeeklyDigestSummary(child.profileId).catch(() => null),
          yearGroupId ? getCurriculumProgress(child.profileId, yearGroupId) : Promise.resolve([]),
        ])
        const actions = buildParentActions(
          child.displayName,
          weakAreas,
          digest,
          recommended,
          child.streakDays,
        )
        return { child, progress, weakAreas, recommended, vault, digest, curriculum, actions }
      }),
    ),
    // profile.id is already fetched above — no need for a second findUnique
    profile?.id
      ? getPendingVaultRequests(profile.id).catch(() => [])
      : Promise.resolve([]),
  ])

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Hi {displayName}</h1>
        <p className="mt-1 text-sm text-muted">
          {children.length === 0
            ? 'Link a child account to see their progress.'
            : children.length === 1
              ? "Here's how your child is getting on."
              : "Here's how your children are getting on."}
        </p>
      </div>

      {/* No children linked — show form prominently */}
      {children.length === 0 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-muted/40 bg-surface p-6">
            <p className="font-heading font-semibold text-ink">Link your child&apos;s account</p>
            <p className="mb-4 mt-1 text-sm text-muted">
              Your child needs their own Decifer account. Ask them to sign up and choose
              &quot;Student&quot;. Once they&apos;ve registered, enter their email below to connect the accounts.
            </p>
            <LinkChildForm />
          </div>

          {/* What parents will track once linked */}
          <div className="rounded-2xl border border-black/5 bg-surface px-5 py-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted">
              What you will track
            </p>
            <ul className="space-y-4">
              {PARENT_PREVIEW_ITEMS.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <item.Icon className="mt-0.5 w-5 h-5 flex-none text-muted" aria-hidden />
                  <div>
                    <p className="font-heading text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Child cards */}
      {childData.map(({ child, progress, weakAreas, recommended, vault, digest, curriculum, actions }) => (
        <div
          key={child.profileId}
          className="rounded-2xl border border-black/5 bg-surface shadow-sm overflow-hidden"
        >
          {/* Child header */}
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">{child.displayName}</h2>
              {child.yearGroupLabel && (
                <p className="mt-0.5 text-xs text-muted">
                  {child.yearGroupLabel}{child.keyStage ? ` · ${child.keyStage}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {child.streakDays > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Flame className="w-3.5 h-3.5" aria-hidden /> {child.streakDays}d streak
                </span>
              )}
              {child.totalPoints > 0 && (
                <span className="inline-flex items-center gap-1 font-heading text-sm font-bold text-points-gold">
                  <Star className="w-3.5 h-3.5" aria-hidden /> {child.totalPoints.toLocaleString()} pts
                </span>
              )}
              <Link href={`/dashboard/parent/children/${child.profileId}`} className="text-xs text-brand font-semibold hover:underline hidden sm:block">
                Full report →
              </Link>
            </div>
          </div>

          {/* ── Two-column layout on desktop ─────────────────────────── */}
          <div className="flex flex-col lg:flex-row lg:divide-x lg:divide-black/5">

            {/* LEFT: summary sidebar */}
            <div className="flex flex-col gap-4 px-5 py-4 lg:w-72 lg:flex-shrink-0">

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Started"  value={progress.topicsStarted} />
                <Stat label="Mastered" value={progress.topicsCompleted} />
                <Stat label="Quizzes"  value={progress.quizAttempts} sub={progress.quizzesThisWeek > 0 ? `${progress.quizzesThisWeek} this wk` : undefined} />
              </div>

              {/* Accuracy */}
              {progress.averageScore !== null && (
                <div className="rounded-xl bg-science/10 px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{Math.round(progress.averageScore * 100)}% accuracy</span>
                  {progress.badgeCount > 0 && <p className="text-xs text-muted mt-0.5">{progress.badgeCount} badge{progress.badgeCount === 1 ? '' : 's'} · {progress.cardCount} cards</p>}
                </div>
              )}

              {/* Recommended next */}
              {recommended && (
                <div className="rounded-xl border border-maths/20 bg-maths/5 px-3 py-2.5">
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-maths">
                    {recommended.isFirstLesson ? 'Start here' : 'Next lesson'}
                  </p>
                  <p className="font-heading text-sm font-semibold text-ink leading-snug">{recommended.lessonTitle}</p>
                  <p className="text-xs text-muted mt-0.5">{recommended.subjectName}{recommended.estimatedMinutes ? ` · ${recommended.estimatedMinutes} min` : ''}</p>
                </div>
              )}

              {/* Weak areas */}
              {weakAreas.length > 0 ? (
                <div className="rounded-xl border border-incorrect/20 bg-incorrect/5 px-3 py-2.5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-incorrect">Areas to strengthen</p>
                  <ul className="space-y-1.5">
                    {weakAreas.map((area) => (
                      <li key={area.topicId} className="flex items-center justify-between text-xs">
                        <span className="text-ink truncate mr-2">{area.topicTitle}</span>
                        <span className="flex-none font-semibold text-incorrect">{Math.round((1 - area.errorRate) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : progress.quizAttempts > 0 ? (
                <p className="text-xs text-science font-medium">✓ No struggle areas yet</p>
              ) : null}

              {/* NL recommendations — "Here's what to do" */}
              {actions.length > 0 && (
                <div className="rounded-xl border border-maths/30 bg-maths/5 px-3 py-2.5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-maths">What to do</p>
                  <ul className="space-y-2">
                    {actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={[
                          'mt-0.5 h-2 w-2 flex-none rounded-full',
                          action.urgency === 'high' ? 'bg-incorrect' : action.urgency === 'medium' ? 'bg-lightning' : 'bg-correct',
                        ].join(' ')} />
                        <p className="text-xs text-ink leading-relaxed">{action.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weekly digest */}
              {digest && (
                <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">This week</p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div><p className="font-heading text-base font-bold text-ink">{digest.quizAttempts}</p><p className="text-[10px] text-muted">quizzes</p></div>
                    <div><p className="font-heading text-base font-bold text-ink">{digest.activeDays}</p><p className="text-[10px] text-muted">active days</p></div>
                    <div>
                      <p className={`font-heading text-base font-bold ${digest.passRate !== null && digest.passRate >= 70 ? 'text-correct' : digest.passRate !== null ? 'text-incorrect' : 'text-ink'}`}>
                        {digest.passRate !== null ? `${digest.passRate}%` : '—'}
                      </p>
                      <p className="text-[10px] text-muted">pass rate</p>
                    </div>
                    <div>
                      <p className="font-heading text-base font-bold text-points-gold">{digest.pointsThisWeek > 0 ? `+${digest.pointsThisWeek.toLocaleString()}` : '—'}</p>
                      <p className="text-[10px] text-muted">points</p>
                    </div>
                  </div>
                  {digest.topicsCompleted > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-science font-medium">
                      <Check className="w-3 h-3" aria-hidden /> {digest.topicsCompleted} topic{digest.topicsCompleted > 1 ? 's' : ''} done
                    </p>
                  )}
                </div>
              )}

              {/* Reward Vault */}
              <Link
                href={`/dashboard/parent/vault/${child.profileId}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 hover:bg-black/[0.04]"
              >
                <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1.5"><Gift className="w-4 h-4" aria-hidden /> Reward Vault</span>
                {vault.pendingRequestCount > 0
                  ? <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{vault.pendingRequestCount}</span>
                  : <span className="text-xs text-muted">→</span>}
              </Link>

            </div>

            {/* RIGHT: curriculum map */}
            <div className="flex-1 min-w-0 px-5 py-4 border-t border-black/5 lg:border-t-0">
              {curriculum.length > 0
                ? <CurriculumMap subjects={curriculum} />
                : <p className="text-sm text-muted">Curriculum map will appear once your child starts topics.</p>
              }
            </div>

          </div>

          {/* Footer links */}
          <div className="border-t border-black/5 px-5 py-3">
            <Link
              href={`/dashboard/parent/children/${child.profileId}`}
              className="text-sm font-semibold text-maths hover:underline"
            >
              View full report →
            </Link>
          </div>
        </div>
      ))}

      {/* ── Reward Vault ─────────────────────────────────────────────���── */}
      {pendingVaultRequests.length > 0 && (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold text-brand flex items-center gap-1"><Gift className="w-4 h-4" aria-hidden /> Reward Vault</h2>
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
              {pendingVaultRequests.length} pending
            </span>
          </div>
          {pendingVaultRequests.map((req) => (
            <div key={req.requestId} className="rounded-xl border border-black/5 bg-surface p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-sm font-bold text-ink">{req.childName}</p>
                  <p className="text-xs text-muted capitalize">{req.milestoneBand} milestone · {req.xpAtRequest.toLocaleString()} XP · {req.topicsAtRequest} topics</p>
                </div>
                {(() => {
                  const s = VAULT_STATUS_LABELS[req.status]
                  return s ? (
                    <span className={`rounded-full ${s.bg} px-2 py-0.5 text-xs font-bold ${s.colour}`}>
                      {s.label}
                    </span>
                  ) : null
                })()}
              </div>
              {req.childMessage && (
                <p className="text-sm text-ink italic">&ldquo;{req.childMessage}&rdquo;</p>
              )}
              <Link
                href={`/dashboard/parent/vault/${req.childProfileId}`}
                className="inline-flex h-9 items-center rounded-xl bg-brand px-4 text-xs font-bold text-white transition-colors hover:bg-brand-600"
              >
                Respond →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Screen-time controls — per-child links */}
      {children.length > 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm space-y-3">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            Screen-time &amp; settings
          </h2>
          {children.map((child) => (
            <Link
              key={child.profileId}
              href={`/dashboard/parent/children/${child.profileId}`}
              className="flex items-center justify-between rounded-xl border border-black/5 bg-black/[0.02] px-4 py-3 hover:bg-black/[0.04]"
            >
              <div>
                <p className="font-heading text-sm font-semibold text-ink">{child.displayName}</p>
                <p className="text-xs text-muted">Set daily limit, leaderboard visibility</p>
              </div>
              <span className="text-xs text-muted">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* Add another child — shown only when at least one child is already linked */}
      {children.length > 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
            Link another child
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Add a second child account using their registered email.
          </p>
          <LinkChildForm />
        </div>
      )}
    </section>
  )
}

function CurriculumMini({
  curriculum,
  childId,
}: {
  curriculum: CurriculumSubject[]
  childId: string
}) {
  const totalTopics = curriculum.reduce((s, sub) => s + sub.totalCount, 0)
  const completedTopics = curriculum.reduce((s, sub) => s + sub.completedCount, 0)
  const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0

  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.02] px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Curriculum progress</p>
        <Link
          href={`/dashboard/parent/children/${childId}`}
          className="text-xs text-brand hover:underline"
        >
          Full breakdown →
        </Link>
      </div>

      {/* Overall bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-ink">{completedTopics} of {totalTopics} topics done</span>
          <span className="font-bold text-maths">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full rounded-full bg-maths" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Per-subject mini bars */}
      <div className="grid gap-1.5">
        {curriculum.map((subj) => {
          const sPct = subj.totalCount > 0
            ? Math.round((subj.completedCount / subj.totalCount) * 100)
            : 0
          // Find the next topic
          const nextTopic = subj.topics.find((t) => t.progressStatus !== 'completed')
          return (
            <div key={subj.subjectId} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: subj.colourToken }}
                aria-hidden
              />
              <span className="w-16 flex-none truncate text-muted">{subj.subjectName}</span>
              <div className="flex-1 overflow-hidden rounded-full bg-black/[0.06] h-1.5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${sPct}%`, backgroundColor: subj.colourToken }}
                />
              </div>
              <span className="w-8 flex-none text-right text-muted">{sPct}%</span>
              {nextTopic && (
                <span className="flex-1 truncate text-muted hidden sm:block">→ {nextTopic.title}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PARENT_PREVIEW_ITEMS: Array<{ Icon: IconComponent; title: string; body: string }> = [
  {
    Icon: BarChart,
    title: 'Topic progress',
    body: 'See which topics your child has started, practised, and completed.',
  },
  {
    Icon: Target,
    title: 'Quiz accuracy',
    body: 'Track average scores and how performance changes over time.',
  },
  {
    Icon: MapPin,
    title: 'Areas to strengthen',
    body: 'Topics with high hint use or low scores are highlighted so you know where to focus.',
  },
  {
    Icon: CalendarDays,
    title: 'Recent activity',
    body: 'A log of recent quiz sessions with dates, topics, and scores.',
  },
]

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: number
  sub?: string
}) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-2 py-3">
      <p className="font-heading text-xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-science">{sub}</p>}
    </div>
  )
}
