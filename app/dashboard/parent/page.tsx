// Parent dashboard home — shows real child progress data from the DB.
// Prerequisite: Lesson Store activation gate must pass before this sprint.
// No fake data, no AI generation, no seed imports.

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'
import {
  getLinkedChildren,
  getChildProgressSummary,
  getChildWeakAreas,
  getRecommendedNextLesson,
} from '@/lib/parent-dashboard'

export const metadata = { title: 'Parent dashboard — Decifer Learning' }

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
      const [progress, weakAreas, recommended] = await Promise.all([
        getChildProgressSummary(child.profileId),
        getChildWeakAreas(child.profileId, 2),
        getRecommendedNextLesson(child.profileId, child.yearGroupLabel),
      ])
      return { child, progress, weakAreas, recommended }
    }),
  )

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

      {/* No children linked */}
      {children.length === 0 && (
        <div className="rounded-2xl border border-dashed border-muted/40 bg-surface p-6 text-center">
          <p className="font-heading font-semibold text-ink">No children linked yet</p>
          <p className="mt-1 text-sm text-muted">
            Ask your child to register and link their account to yours.
          </p>
        </div>
      )}

      {/* Child cards */}
      {childData.map(({ child, progress, weakAreas, recommended }) => (
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

          {/* Footer link */}
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

      {/* Screen-time controls placeholder */}
      <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
          Screen-time controls
        </h2>
        <p className="mt-1 text-sm text-muted">
          Daily time limits and allowed hours are coming in Phase 9.
        </p>
      </div>
    </section>
  )
}

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
