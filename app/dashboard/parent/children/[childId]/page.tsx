// Per-child detail page — full progress report for a linked child.
// Security: verifies parent→child link before returning any data.
// No fake data, no AI generation, no seed imports.

import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { getTopicCurriculumCoverage } from '@/lib/curriculum'
import {
  getChildProgressSummary,
  getChildWeakAreas,
  getRecommendedNextLesson,
  getRecentActivity,
  getEarnedBadges,
  getCardCollectionSummary,
  getMostRecentTopicId,
} from '@/lib/parent-dashboard'

export const metadata = { title: 'Child report — Decifer Learning' }

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common']
const RARITY_LABEL: Record<string, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
}

export default async function ChildDetailPage({
  params,
}: {
  params: { childId: string }
}) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const parentProfile = user ? await getCurrentProfile(supabase, user.id) : null
  if (!parentProfile || parentProfile.role !== 'parent') redirect('/dashboard')

  // Load child profile
  const childProfile = await prisma.profile.findUnique({
    where: { id: params.childId },
    include: { year_group: true },
  })
  if (!childProfile) notFound()

  // Verify parent→child link
  const link = await prisma.familyLink.findFirst({
    where: {
      parent_user_id: parentProfile.user_id,
      child_user_id: childProfile.user_id,
    },
  })
  if (!link) notFound()

  const yearGroupLabel = childProfile.year_group?.label ?? null
  const keyStage = childProfile.year_group?.key_stage ?? null

  // Fetch all child data in parallel
  const [progress, weakAreas, recentActivity, badges, cards, recentTopicId, recommended] =
    await Promise.all([
      getChildProgressSummary(childProfile.id),
      getChildWeakAreas(childProfile.id),
      getRecentActivity(childProfile.id),
      getEarnedBadges(childProfile.id),
      getCardCollectionSummary(childProfile.id),
      getMostRecentTopicId(childProfile.id),
      getRecommendedNextLesson(childProfile.id, yearGroupLabel),
    ])

  // Curriculum coverage for most recent topic (sequential — depends on recentTopicId)
  const curriculumCoverage = recentTopicId
    ? await getTopicCurriculumCoverage(recentTopicId)
    : null

  const lessonHref =
    recommended?.subjectSlug && recommended.topicSlug && recommended.lessonSlug
      ? `/learn/${recommended.subjectSlug}/${recommended.topicSlug}/${recommended.lessonSlug}`
      : null

  return (
    <section className="space-y-5">
      {/* Back link */}
      <Link
        href="/dashboard/parent"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        ← Back to overview
      </Link>

      {/* Child header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">
            {childProfile.display_name}
          </h1>
          {yearGroupLabel && (
            <p className="mt-0.5 text-sm text-muted">
              {yearGroupLabel}
              {keyStage ? ` · ${keyStage}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          {childProfile.total_points > 0 && (
            <span className="font-heading text-sm font-bold text-points-gold">
              ⭐ {childProfile.total_points.toLocaleString()} pts
            </span>
          )}
          {childProfile.streak_days > 0 && (
            <span className="text-xs text-muted">🔥 {childProfile.streak_days} day streak</span>
          )}
        </div>
      </div>

      {/* Progress overview */}
      <Card title="Progress overview">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Topics started" value={progress.topicsStarted} />
          <Stat label="Topics mastered" value={progress.topicsCompleted} />
          <Stat label="Quizzes taken" value={progress.quizAttempts} />
          <Stat
            label="This week"
            value={progress.quizzesThisWeek}
            sub={progress.quizzesThisWeek === 1 ? 'quiz' : 'quizzes'}
          />
        </div>
        {progress.averageScore !== null ? (
          <div className="mt-4 rounded-xl bg-science/10 px-4 py-3 text-sm">
            <span className="font-semibold text-ink">
              {Math.round(progress.averageScore * 100)}% average accuracy
            </span>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Average accuracy will appear after your child completes quizzes.
          </p>
        )}
        <div className="mt-3 flex gap-4 text-sm text-muted">
          {progress.badgeCount > 0 && (
            <span>🏅 {progress.badgeCount} badge{progress.badgeCount === 1 ? '' : 's'}</span>
          )}
          {progress.cardCount > 0 && (
            <span>🃏 {progress.cardCount} discovery card{progress.cardCount === 1 ? '' : 's'}</span>
          )}
        </div>
      </Card>

      {/* Recommended next lesson */}
      <Card title="Recommended next lesson">
        {recommended ? (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-maths">
              {recommended.isFirstLesson ? 'Start with this lesson' : 'Continue here'}
            </p>
            <p className="font-heading text-lg font-bold text-ink">{recommended.lessonTitle}</p>
            <p className="text-sm text-muted">
              {recommended.topicTitle} · {recommended.subjectName}
              {recommended.difficultyLane ? ` · ${recommended.difficultyLane}` : ''}
              {recommended.estimatedMinutes ? ` · ${recommended.estimatedMinutes} min` : ''}
            </p>
            {lessonHref && (
              <Link
                href={lessonHref}
                className="mt-2 inline-flex min-h-[44px] items-center rounded-xl bg-maths/10 px-4 py-2 text-sm font-bold text-maths transition-colors hover:bg-maths/20"
              >
                View lesson →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            No published lessons available yet for {yearGroupLabel ?? 'this year group'}.
          </p>
        )}
      </Card>

      {/* Weak areas */}
      <Card title="Areas to strengthen">
        {weakAreas.length > 0 ? (
          <ul className="space-y-3">
            {weakAreas.map((area) => (
              <li key={area.topicId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{area.topicTitle}</span>
                  <span className="text-muted">
                    {Math.round((1 - area.errorRate) * 100)}% correct out of {area.totalAnswered}{' '}
                    questions
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-incorrect/60"
                    style={{ width: `${Math.round(area.errorRate * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : progress.quizAttempts > 0 ? (
          <p className="text-sm text-science">
            Great work — no struggle areas detected yet. Keep it up!
          </p>
        ) : (
          <p className="text-sm text-muted">
            Weak areas will appear after your child completes quizzes.
          </p>
        )}
      </Card>

      {/* Curriculum coverage */}
      <Card title="Curriculum coverage">
        {curriculumCoverage ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">{curriculumCoverage.topicTitle}</p>
            {curriculumCoverage.totalOutcomes > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat
                    label="Outcomes mapped"
                    value={curriculumCoverage.mappedOutcomes}
                  />
                  <Stat
                    label="Verified"
                    value={curriculumCoverage.verifiedOutcomes}
                  />
                  <Stat
                    label="Total"
                    value={curriculumCoverage.totalOutcomes}
                  />
                </div>
                {curriculumCoverage.isCurriculumComplete ? (
                  <p className="rounded-xl bg-science/10 px-4 py-2 text-sm font-semibold text-science">
                    All learning content is ready for this topic.
                  </p>
                ) : (
                  <p className="rounded-xl bg-lightning/20 px-4 py-2 text-sm text-ink">
                    Some additional content is still being prepared for this topic.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">
                Curriculum mapping is in progress for this topic.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Curriculum coverage will appear as your child progresses through topics.
          </p>
        )}
      </Card>

      {/* Recent activity */}
      <Card title="Recent quiz sessions">
        {recentActivity.length > 0 ? (
          <ul className="divide-y divide-black/[0.04]">
            {recentActivity.map((item) => (
              <li
                key={item.attemptId}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-ink">{item.topicTitle}</p>
                  <p className="text-xs text-muted">
                    {formatDate(item.createdAt)}
                    {item.hintsUsed > 0 ? ` · ${item.hintsUsed} hint${item.hintsUsed === 1 ? '' : 's'} used` : ''}
                  </p>
                </div>
                <span
                  className={`font-bold ${
                    item.score >= 0.7 ? 'text-correct' : 'text-incorrect'
                  }`}
                >
                  {Math.round(item.score * 100)}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No quiz sessions yet.</p>
        )}
      </Card>

      {/* Badges earned */}
      <Card title="Badges earned">
        {badges.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.map((badge) => (
              <li
                key={badge.badgeId}
                className="flex flex-col items-center rounded-xl bg-black/[0.03] p-3 text-center"
              >
                {badge.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={badge.iconUrl}
                    alt={badge.name}
                    className="mb-1 h-8 w-8 object-contain"
                  />
                ) : (
                  <span className="mb-1 text-2xl">🏅</span>
                )}
                <p className="text-xs font-semibold text-ink">{badge.name}</p>
                {badge.description && (
                  <p className="mt-0.5 text-xs text-muted">{badge.description}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No badges yet. Complete quizzes and hit perfect scores to earn them!
          </p>
        )}
      </Card>

      {/* Discovery cards */}
      <Card title="Discovery cards">
        {cards.total > 0 ? (
          <div className="space-y-2">
            <p className="font-heading text-2xl font-bold text-ink">
              {cards.total}{' '}
              <span className="text-base font-normal text-muted">
                card{cards.total === 1 ? '' : 's'} collected
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {RARITY_ORDER.filter((r) => (cards.byRarity[r] ?? 0) > 0).map((rarity) => (
                <span
                  key={rarity}
                  className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-semibold text-ink"
                >
                  {RARITY_LABEL[rarity] ?? rarity}: {cards.byRarity[rarity]}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No discovery cards yet. Cards drop after completing a quiz.
          </p>
        )}
      </Card>

      {/* Screen-time controls placeholder */}
      <Card title="Screen-time controls">
        <p className="text-sm text-muted">
          Daily time limits and allowed hours are coming soon.
        </p>
      </Card>
    </section>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm">
      <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-2 py-3 text-center">
      <p className="font-heading text-xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}
