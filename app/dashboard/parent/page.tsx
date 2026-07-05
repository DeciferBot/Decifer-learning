// Parent dashboard home — shows real child progress data from the DB.
// Prerequisite: Lesson Store activation gate must pass before this sprint.
// No fake data, no AI generation, no seed imports.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { buildParentActions } from '@/lib/parent-recommendations'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
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
import { SubscriptionStatus } from '@/components/parent/SubscriptionStatus'
import { PurchaseTracker } from '@/components/analytics/PurchaseTracker'
import { Star, Flame, Gift, BarChart, Target, MapPin, CalendarDays, Check, CircleCheck, ClipboardList, Clock } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export const metadata = { title: 'Parent dashboard' }

const VAULT_STATUS_LABELS: Record<string, { label: string; colour: string; bg: string }> = {
  pending:         { label: 'Waiting for parent', colour: 'text-points-gold-700', bg: 'bg-points-gold/20' },
  deferred:        { label: 'Deferred',           colour: 'text-muted',       bg: 'bg-black/5'        },
  counter_offered: { label: 'Waiting for child',  colour: 'text-maths',       bg: 'bg-maths/15'       },
}

export default async function ParentDashboardPage() {
  const supabase = createSupabaseServerClient()
  const user = await getAuthUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const displayName = profile?.display_name ?? (user ? getUserDisplayName(user) : 'Parent')

  const children = profile ? await getLinkedChildren(profile.user_id) : []

  // Subscription status for the parent (guarded: model may not exist in older deploys)
  let subscription: { plan: string; status: string; current_period_end: Date | null } | null = null
  try {
    subscription = user
      ? await (prisma as any).subscription?.findUnique?.({
          where: { user_id: user.id },
          select: { plan: true, status: true, current_period_end: true },
        }) ?? null
      : null
  } catch {
    subscription = null
  }

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
      {/* Fires GA4 `purchase` once when returning from Stripe checkout */}
      <PurchaseTracker />
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

      {/* Subscription status */}
      <SubscriptionStatus
        plan={subscription?.plan ?? 'free'}
        status={subscription?.status ?? null}
        periodEnd={subscription?.current_period_end?.toISOString() ?? null}
      />

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

      {/* Child cards — compact glance cards with a single primary CTA */}
      {childData.map(({ child, progress, weakAreas, vault, digest, curriculum }) => {
        // Curriculum % for the mini bar
        const totalTopics = curriculum.reduce((s, sub) => s + sub.totalCount, 0)
        const completedTopics = curriculum.reduce((s, sub) => s + sub.completedCount, 0)
        const curriculumPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : null

        return (
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
                    <Flame className="w-3.5 h-3.5" aria-hidden /> {child.streakDays}d
                  </span>
                )}
                {child.totalPoints > 0 && (
                  <span className="inline-flex items-center gap-1 font-heading text-sm font-bold text-points-gold-700">
                    <Star className="w-3.5 h-3.5" aria-hidden /> {child.totalPoints.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Glance row — 3 stats + accuracy */}
            <div className="px-5 py-4 space-y-3">
              {/* Wins first — lead with what went well, not deficits */}
              {digest && digest.quizAttempts > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-correct/10 px-3 py-2 text-sm">
                  <span aria-hidden>🎉</span>
                  <p className="text-ink">
                    <span className="font-semibold">This week:</span> {digest.quizAttempts} quiz{digest.quizAttempts === 1 ? '' : 'zes'}
                    {digest.pointsThisWeek > 0 ? ` · +${digest.pointsThisWeek.toLocaleString()} pts` : ''}
                    {digest.topicsCompleted > 0 ? ` · ${digest.topicsCompleted} mastered` : ''}
                    {child.streakDays >= 3 ? ` · 🔥 ${child.streakDays}-day streak` : ''}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Started"  value={progress.topicsStarted} />
                <Stat label="Mastered" value={progress.topicsCompleted} />
                <Stat label="Quizzes"  value={progress.quizAttempts} sub={progress.quizzesThisWeek > 0 ? `${progress.quizzesThisWeek} this wk` : undefined} />
              </div>

              {/* Accuracy */}
              {progress.averageScore !== null && (
                <div className="rounded-xl bg-science/10 px-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{Math.round(progress.averageScore * 100)}% accuracy</span>
                  {digest && digest.passRate !== null && (
                    <span className="ml-2 text-xs text-muted">{digest.passRate}% pass rate this week</span>
                  )}
                </div>
              )}

              {/* Curriculum progress mini-bar */}
              {curriculumPct !== null && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">Curriculum</span>
                    <span className="font-bold text-maths">{curriculumPct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-maths" style={{ width: `${curriculumPct}%` }} />
                  </div>
                </div>
              )}

              {/* Weak areas — count only, detail is in full report */}
              {weakAreas.length > 0 ? (
                <p className="text-xs text-incorrect font-medium">
                  ⚠ {weakAreas.length} area{weakAreas.length === 1 ? '' : 's'} to strengthen, see full report
                </p>
              ) : progress.quizAttempts > 0 ? (
                <p className="text-xs text-science font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" aria-hidden /> No struggle areas yet
                </p>
              ) : null}

              {/* Quick-action chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/dashboard/parent/children/${child.profileId}?tab=settings`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-black/[0.04] px-3 py-2 text-xs font-semibold text-ink hover:bg-black/[0.08] transition-colors"
                >
                  <ClipboardList className="w-3.5 h-3.5" aria-hidden /> Set exam
                </Link>
                <Link
                  href={`/dashboard/parent/children/${child.profileId}?tab=settings`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-black/[0.04] px-3 py-2 text-xs font-semibold text-ink hover:bg-black/[0.08] transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" aria-hidden /> Screen time
                </Link>
                {vault.pendingRequestCount > 0 && (
                  <Link
                    href={`/dashboard/parent/vault/${child.profileId}`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-brand/10 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition-colors"
                  >
                    <Gift className="w-3.5 h-3.5" aria-hidden /> Vault ({vault.pendingRequestCount})
                  </Link>
                )}
              </div>
            </div>

            {/* Primary CTA — full width, always visible */}
            <div className="border-t border-black/5 px-5 py-3">
              <Link
                href={`/dashboard/parent/children/${child.profileId}`}
                className="flex w-full items-center justify-center rounded-xl bg-maths py-3 font-heading text-sm font-bold text-white transition-colors hover:bg-maths/90 min-h-[48px]"
              >
                Open {child.displayName}&apos;s full report →
              </Link>
            </div>
          </div>
        )
      })}

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
