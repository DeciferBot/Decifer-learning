// Per-child detail page — full progress report including PLI v1 Learning Map.
// Security: verifies parent→child link before returning any data.
// No fake data, no AI generation, no diagnosis language.

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
  getProgressBySubject,
  getStrongestTopics,
} from '@/lib/parent-dashboard'
import { getSignalsForChild } from '@/lib/learning-signals-runner'
import type { LearningSignal } from '@/lib/learning-signals'

export const metadata = { title: 'Child report — Decifer Learning' }

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common']
const RARITY_LABEL: Record<string, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
}

const CONFIDENCE_LABEL: Record<string, string> = {
  early:    'Early signal',
  moderate: 'Moderate signal',
  strong:   'Strong signal',
}
const CONFIDENCE_COLOUR: Record<string, string> = {
  early:    'text-muted bg-black/[0.04]',
  moderate: 'text-points-gold bg-points-gold/10',
  strong:   'text-incorrect bg-incorrect/10',
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
  const [
    progress,
    weakAreas,
    recentActivity,
    badges,
    cards,
    recentTopicId,
    recommended,
    subjectProgress,
    strongTopics,
    signals,
  ] = await Promise.all([
    getChildProgressSummary(childProfile.id),
    getChildWeakAreas(childProfile.id),
    getRecentActivity(childProfile.id),
    getEarnedBadges(childProfile.id),
    getCardCollectionSummary(childProfile.id),
    getMostRecentTopicId(childProfile.id),
    getRecommendedNextLesson(childProfile.id, yearGroupLabel),
    getProgressBySubject(childProfile.id),
    getStrongestTopics(childProfile.id, 5),
    getSignalsForChild(childProfile.id),
  ])

  // Curriculum coverage for most recent topic (sequential — depends on recentTopicId)
  const curriculumCoverage = recentTopicId
    ? await getTopicCurriculumCoverage(recentTopicId)
    : null

  const lessonHref =
    recommended?.subjectSlug && recommended.topicSlug && recommended.lessonSlug
      ? `/learn/${recommended.subjectSlug}/${recommended.topicSlug}/${recommended.lessonSlug}`
      : null

  // Only show signals that have enough evidence
  const actionableSignals = signals.slice(0, 5)

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

      {/* ════════════════════════════════════════════════════════════════════
          LEARNING MAP — PLI v1
          ════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-maths/20 bg-maths/5 px-5 py-4 shadow-sm">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-maths">
          Learning map
        </p>
        <h2 className="mb-4 font-heading text-lg font-bold text-ink">
          How {childProfile.display_name} is moving through the curriculum
        </h2>

        {/* 1 ── Progress by subject */}
        {subjectProgress.length > 0 ? (
          <div className="mb-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Progress by subject
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjectProgress.map((s) => (
                <div
                  key={s.subjectId}
                  className="rounded-xl border border-black/5 bg-surface px-4 py-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-full"
                      style={{ backgroundColor: s.colourToken }}
                      aria-hidden
                    />
                    <span className="font-heading text-sm font-bold text-ink">{s.subjectName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-black/[0.03] px-2 py-2">
                      <p className="font-heading text-lg font-bold text-ink">{s.topicsStarted}</p>
                      <p className="text-xs text-muted">topics started</p>
                    </div>
                    <div className="rounded-lg bg-black/[0.03] px-2 py-2">
                      <p className="font-heading text-lg font-bold text-ink">{s.topicsCompleted}</p>
                      <p className="text-xs text-muted">completed</p>
                    </div>
                  </div>
                  {s.averageScore !== null && (
                    <p className="mt-2 text-xs text-muted">
                      {Math.round(s.averageScore * 100)}% average accuracy
                      {s.totalQuizAttempts > 0 ? ` across ${s.totalQuizAttempts} quiz${s.totalQuizAttempts === 1 ? '' : 'zes'}` : ''}
                    </p>
                  )}
                  {s.lastActivityAt && (
                    <p className="mt-0.5 text-xs text-muted">
                      Last activity: {formatDate(s.lastActivityAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted">
            Subject progress will appear after {childProfile.display_name} completes topics.
          </p>
        )}

        {/* 2 ── Doing well so far */}
        {strongTopics.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-correct">
              Doing well so far
            </p>
            <ul className="space-y-2">
              {strongTopics.map((t) => (
                <li key={t.topicId} className="rounded-xl border border-correct/15 bg-correct/5 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-sm font-semibold text-ink">{t.topicTitle}</p>
                      <p className="text-xs text-muted">{t.subjectName}</p>
                    </div>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-bold ${
                      t.signal === 'strong' ? 'bg-correct/20 text-correct' : 'bg-black/[0.06] text-muted'
                    }`}>
                      {t.signal === 'strong' ? 'Strong signal' : 'Early signal'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {t.repetitions >= 2
                      ? `Repeated successfully across ${t.repetitions + 1} review attempts — last score ${Math.round(t.lastScore * 100)}%.`
                      : `Completed with ${Math.round(t.lastScore * 100)}% on the last attempt.`}
                    {t.completedAt ? ` ${formatDate(t.completedAt)}.` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3 ── Needs support */}
        {weakAreas.length > 0 ? (
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-incorrect">
              Needs support
            </p>
            <ul className="space-y-2">
              {weakAreas.map((area) => (
                <li key={area.topicId} className="rounded-xl border border-incorrect/15 bg-incorrect/5 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-sm font-semibold text-ink">{area.topicTitle}</p>
                      <p className="text-xs text-muted">{area.subjectName}</p>
                    </div>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-bold ${CONFIDENCE_COLOUR[area.signal]}`}>
                      {CONFIDENCE_LABEL[area.signal]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Lower accuracy in this topic across {area.totalAnswered} answers
                    ({Math.round(area.errorRate * 100)}% incorrect).
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full bg-incorrect/60"
                      style={{ width: `${Math.round(area.errorRate * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : progress.quizAttempts > 0 ? (
          <p className="mb-4 text-sm text-correct">
            No topics with lower accuracy detected yet. Keep going.
          </p>
        ) : null}

        {/* 4 ── Learning signals */}
        {actionableSignals.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Learning patterns
            </p>
            <ul className="space-y-3">
              {actionableSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Patterns are based on quiz results, lesson activity, and progress data. They may suggest
              a direction — they do not diagnose or predict.
            </p>
          </div>
        )}
      </div>

      {/* ── Recommended next lesson ─────────────────────────────────────────── */}
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

      {/* ── Progress overview ───────────────────────────────────────────────── */}
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
            Average accuracy will appear after {childProfile.display_name} completes quizzes.
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

      {/* ── Curriculum coverage ─────────────────────────────────────────────── */}
      <Card title="Curriculum coverage">
        {curriculumCoverage ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">{curriculumCoverage.topicTitle}</p>
            {curriculumCoverage.totalOutcomes > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="Outcomes mapped" value={curriculumCoverage.mappedOutcomes} />
                  <Stat label="Verified" value={curriculumCoverage.verifiedOutcomes} />
                  <Stat label="Total" value={curriculumCoverage.totalOutcomes} />
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
            Curriculum coverage will appear as {childProfile.display_name} progresses through topics.
          </p>
        )}
      </Card>

      {/* ── Recent activity ─────────────────────────────────────────────────── */}
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

      {/* ── Badges ──────────────────────────────────────────────────────────── */}
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
                  <img src={badge.iconUrl} alt={badge.name} className="mb-1 h-8 w-8 object-contain" />
                ) : (
                  <span className="mb-1 text-2xl">🏅</span>
                )}
                <p className="text-xs font-semibold text-ink">{badge.name}</p>
                {badge.description && <p className="mt-0.5 text-xs text-muted">{badge.description}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No badges yet. Complete quizzes and hit perfect scores to earn them!
          </p>
        )}
      </Card>

      {/* ── Discovery cards ─────────────────────────────────────────────────── */}
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

      {/* ── Screen-time controls placeholder ───────────────────────────────── */}
      <Card title="Screen-time controls">
        <p className="text-sm text-muted">
          Daily time limits and allowed hours are coming soon.
        </p>
      </Card>
    </section>
  )
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: LearningSignal }) {
  const badgeClass = CONFIDENCE_COLOUR[signal.confidence] ?? 'bg-black/[0.05] text-muted'
  const badgeLabel = CONFIDENCE_LABEL[signal.confidence] ?? signal.confidence

  return (
    <li className="rounded-xl border border-black/5 bg-surface px-4 py-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-heading text-sm font-semibold text-ink">{signal.title}</p>
        <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-bold ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <p className="text-xs text-muted">{signal.evidenceSummary}</p>
      {signal.whatThisMayMean && (
        <p className="mt-1.5 text-xs text-ink">{signal.whatThisMayMean}</p>
      )}
      {signal.recommendedAction && (
        <p className="mt-2 rounded-lg bg-maths/8 px-3 py-2 text-xs font-medium text-maths">
          Next step: {signal.recommendedAction}
        </p>
      )}
    </li>
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
