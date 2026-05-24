// Parent dashboard home — shows real child progress data from the DB.
// Prerequisite: Lesson Store activation gate must pass before this sprint.
// No fake data, no AI generation, no seed imports.

import Link from 'next/link'
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
} from '@/lib/parent-dashboard'
import { LinkChildForm } from '@/components/parent/LinkChildForm'

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
  const childData = await Promise.all(
    children.map(async (child) => {
      const [progress, weakAreas, recommended, vault] = await Promise.all([
        getChildProgressSummary(child.profileId),
        getChildWeakAreas(child.profileId, 2),
        getRecommendedNextLesson(child.profileId, child.yearGroupLabel),
        getChildVaultSummary(child.profileId).catch(() => ({ creditBalance: 0, currentBand: 'none', pendingRequestCount: 0 })),
      ])
      return { child, progress, weakAreas, recommended, vault }
    }),
  )

  const parentProfile = profile ? await prisma.profile.findUnique({
    where: { user_id: profile.user_id },
    select: { id: true },
  }) : null

  const pendingVaultRequests = parentProfile
    ? await getPendingVaultRequests(parentProfile.id).catch(() => [])
    : []

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
                  <span className="mt-0.5 flex-none text-xl" aria-hidden>{item.icon}</span>
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
      {childData.map(({ child, progress, weakAreas, recommended, vault }) => (
        <div
          key={child.profileId}
          className="rounded-2xl border border-black/5 bg-surface shadow-sm"
        >
          {/* Child header */}
          <div className="flex items-start justify-between border-b border-black/5 px-5 py-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">{child.displayName}</h2>
              {child.yearGroupLabel && (
                <p className="mt-0.5 text-xs text-muted">
                  {child.yearGroupLabel}
                  {child.keyStage ? ` · ${child.keyStage}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              {child.totalPoints > 0 && (
                <span className="font-heading text-sm font-bold text-points-gold">
                  ⭐ {child.totalPoints.toLocaleString()} pts
                </span>
              )}
              {child.streakDays > 0 && (
                <span className="text-xs text-muted">🔥 {child.streakDays} day streak</span>
              )}
            </div>
          </div>

          <div className="space-y-4 px-5 py-4">
            {/* Progress snapshot */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Topics started" value={progress.topicsStarted} />
              <Stat label="Topics mastered" value={progress.topicsCompleted} />
              <Stat
                label="Quizzes taken"
                value={progress.quizAttempts}
                sub={
                  progress.quizzesThisWeek > 0
                    ? `${progress.quizzesThisWeek} this week`
                    : undefined
                }
              />
            </div>

            {/* Accuracy strip */}
            {progress.averageScore !== null && (
              <div className="rounded-xl bg-science/10 px-4 py-2 text-sm">
                <span className="font-semibold text-ink">
                  {Math.round(progress.averageScore * 100)}% average accuracy
                </span>
                {progress.badgeCount > 0 && (
                  <span className="ml-3 text-muted">
                    · {progress.badgeCount} badge{progress.badgeCount === 1 ? '' : 's'} earned
                  </span>
                )}
                {progress.cardCount > 0 && (
                  <span className="ml-3 text-muted">
                    · {progress.cardCount} card{progress.cardCount === 1 ? '' : 's'} collected
                  </span>
                )}
              </div>
            )}

            {/* Recommended next lesson */}
            {recommended ? (
              <div className="rounded-xl border border-maths/20 bg-maths/5 px-4 py-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-maths">
                  {recommended.isFirstLesson ? 'Start here' : 'Next lesson'}
                </p>
                <p className="font-heading font-semibold text-ink">{recommended.lessonTitle}</p>
                <p className="text-xs text-muted">
                  {recommended.topicTitle} · {recommended.subjectName}
                  {recommended.estimatedMinutes ? ` · ${recommended.estimatedMinutes} min` : ''}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-muted">
                No lessons available yet for {child.yearGroupLabel ?? 'this year group'}.
              </div>
            )}

            {/* Weak areas */}
            {weakAreas.length > 0 ? (
              <div className="rounded-xl border border-incorrect/20 bg-incorrect/5 px-4 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-incorrect">
                  Areas to strengthen
                </p>
                <ul className="space-y-1">
                  {weakAreas.map((area) => (
                    <li key={area.topicId} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{area.topicTitle}</span>
                      <span className="text-muted">
                        {Math.round((1 - area.errorRate) * 100)}% correct
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : progress.quizAttempts > 0 ? (
              <p className="text-sm text-science">
                Great work — no struggle areas detected yet.
              </p>
            ) : (
              <p className="text-sm text-muted">
                Weak areas will appear after your child completes quizzes.
              </p>
            )}
          </div>

          {/* Footer links */}
          <div className="flex items-center justify-between gap-3 border-t border-black/5 px-5 py-3">
            <Link
              href={`/dashboard/parent/children/${child.profileId}`}
              className="text-sm font-semibold text-maths hover:underline"
            >
              View full report →
            </Link>
            <Link
              href={`/dashboard/parent/vault/${child.profileId}`}
              className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
            >
              🎁 Reward Vault
              {vault.pendingRequestCount > 0 && (
                <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-xs font-bold text-white">
                  {vault.pendingRequestCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      ))}

      {/* ── Reward Vault ─────────────────────────────────────────────���── */}
      {pendingVaultRequests.length > 0 && (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold text-brand">🎁 Reward Vault</h2>
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

      {/* Screen-time controls placeholder */}
      <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
          Screen-time controls
        </h2>
        <p className="mt-1 text-sm text-muted">
          Daily time limits and allowed hours are coming soon.
        </p>
      </div>

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

const PARENT_PREVIEW_ITEMS = [
  {
    icon: '📊',
    title: 'Topic progress',
    body: 'See which topics your child has started, practised, and completed.',
  },
  {
    icon: '🎯',
    title: 'Quiz accuracy',
    body: 'Track average scores and how performance changes over time.',
  },
  {
    icon: '📍',
    title: 'Areas to strengthen',
    body: 'Topics with high hint use or low scores are highlighted so you know where to focus.',
  },
  {
    icon: '📅',
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
