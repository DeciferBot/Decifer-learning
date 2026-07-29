// Child home — "What should I do next?"
//
// This screen used to answer that question with nineteen tappable destinations
// stacked down a 375 px phone: focus topics, a card teaser, revisit, the daily
// challenge, a breadth nudge, Explore, the world map, cards, missions, the
// leaderboard, customise, the vault, the full curriculum map and a notifications
// prompt. Eight of them were gradient cards with an arrow, so nothing looked more
// important than anything else and the child had to make a decision before any
// learning started.
//
// Now it answers with one thing. `pickNextAction` below chooses it, the stat
// strip carries the numbers, and everything else moves either into the bottom
// tab bar (which already carries World Map, Explore, Cards and Profile) or into
// a single compact row.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getChildGate } from '@/lib/child-gate'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChildCurriculumMap } from '@/components/child/ChildCurriculumMap'
import { getCurriculumProgress } from '@/lib/parent-dashboard'
import type { CurriculumSubject } from '@/lib/parent-dashboard'
import { StreakPing } from './StreakPing'
import { getVaultStatus } from '@/lib/vault/status'
import { NewParentLinkNotice } from './NewParentLinkNotice'
import { DailyGoalRing, StreakReminderPrompt } from '@/components/child/DailyGoalRing'
import { Layers, Star, Target, Trophy, PencilLine, BookOpen, Gift, Flame, MapPin, RefreshCw, Shield } from '@/components/ui/icons'

export const metadata = { title: 'Home' }

// Re-render at most once per 60 s; stale data served instantly from cache.
// Points/streak come from the profile row which updates on quiz submit, so
// a 60 s window is fine for the dashboard teaser values.
export const revalidate = 60

type NextAction = {
  /** Small label above the title, e.g. "Set by your parent". */
  kicker: string
  title: string
  subtitle: string
  href: string
  cta: string
}

/**
 * The single thing this child should do next, in priority order:
 *
 *   1. a topic their parent asked them to focus on
 *   2. a topic SM-2 says is due for review
 *   3. a topic they have already started
 *   4. the next topic they have not met yet
 *   5. nothing left in the year → the daily challenge
 *
 * Returns null only when there is no published content at all, which the empty
 * state below handles.
 */
function pickNextAction(opts: {
  assigned: { topicTitle: string; topicId: string; subject: string } | null
  revisit: { id: string; title: string; subject: string } | null
  subjects: CurriculumSubject[]
  quizableTopicIds: Set<string>
  neverPlayed: boolean
}): NextAction | null {
  const { assigned, revisit, subjects, quizableTopicIds, neverPlayed } = opts

  if (assigned) {
    return {
      kicker: 'Set by your parent',
      title: assigned.topicTitle,
      subtitle: `${assigned.subject} · start with the lesson`,
      href: `/topics/${assigned.topicId}/learn`,
      cta: 'Start →',
    }
  }

  if (revisit) {
    return {
      kicker: 'Time to revisit',
      title: revisit.title,
      subtitle: `${revisit.subject} · a quick replay locks it in`,
      href: `/topics/${revisit.id}/quiz`,
      cta: 'Replay →',
    }
  }

  const allTopics = subjects.flatMap((s) => s.topics.map((t) => ({ ...t, subject: s.subjectName })))

  const inProgress = allTopics.find(
    (t) => t.progressStatus === 'in_progress' && quizableTopicIds.has(t.topicId),
  )
  if (inProgress) {
    return {
      kicker: 'Pick up where you left off',
      title: inProgress.title,
      subtitle: `${inProgress.subject} · a short round, about 2 minutes`,
      href: `/topics/${inProgress.topicId}/quiz`,
      cta: 'Carry on →',
    }
  }

  const fresh = allTopics.find((t) => t.progressStatus === 'not_started')
  if (fresh) {
    return {
      kicker: neverPlayed ? 'Your first topic' : 'Next up',
      title: fresh.title,
      subtitle: `${fresh.subject} · start with the lesson`,
      href: `/topics/${fresh.topicId}/learn`,
      cta: 'Start →',
    }
  }

  return null
}

export default async function ChildDashboardPage() {
  const supabase = createSupabaseServerClient()
  const user = await getAuthUser()

  // First-run gate: send children who haven't seen the prompt to /onboarding.
  if (user && (await getChildGate(user.id)).needsOnboarding) redirect('/onboarding')

  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const displayName = profile?.display_name ?? (user ? getUserDisplayName(user) : 'Explorer')
  const yearGroup = MVP_YEAR_GROUPS.find((y) => y.label === profile?.year_group_label)

  // Check for an unseen parent link so we can show a first-time notice
  const unseenLink = user
    ? await prisma.familyLink.findFirst({
        where: { child_user_id: user.id, seen_by_child: false },
        include: { parent: { select: { display_name: true } } },
      })
    : null

  // Fire all independent DB queries in parallel — topics, collection count, vault, assigned focus topics, curriculum progress, spaced-repetition reviews due, streak shields, quiz-attempt count, rounds played today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [topicRows, collectionCount, vaultResult, assignedMissions, curriculumSubjects, dueReviews, shieldRow, attemptCount, roundsToday, dailyChallengeToday] = await Promise.all([
    profile?.year_group_id
      ? prisma.topic.findMany({
          where: { year_group_id: profile.year_group_id, is_published: true },
          select: {
            id: true,
            title: true,
            order_index: true,
            subject: { select: { name: true, colour_token: true } },
            _count: { select: { quiz_questions: { where: { status: 'published' } } } },
          },
          orderBy: { order_index: 'asc' },
        })
      : Promise.resolve([]),
    profile?.id
      ? prisma.childCollection.count({ where: { profile_id: profile.id } })
      : Promise.resolve(0),
    profile?.id
      ? getVaultStatus(profile.id).catch(() => null)
      : Promise.resolve(null),
    profile?.id
      ? prisma.childMission.findMany({
          where: {
            profile_id:   profile.id,
            mission_type: 'parent_assigned',
            completed_at: null,
          },
          include: { topic: { select: { id: true, title: true, subject: { select: { name: true, colour_token: true } } } } },
          orderBy: { created_at: 'asc' },
        })
      : Promise.resolve([]),
    profile?.id && profile?.year_group_id
      ? getCurriculumProgress(profile.id, profile.year_group_id)
      : Promise.resolve([]),
    profile?.id
      ? prisma.topicProgress.findMany({
          where: { profile_id: profile.id, status: 'completed', sr_next_review: { lte: new Date() } },
          include: { topic: { select: { id: true, title: true, is_published: true, subject: { select: { name: true, colour_token: true } } } } },
          orderBy: { sr_next_review: 'asc' },
          take: 4,
        })
      : Promise.resolve([]),
    profile?.id
      ? prisma.streakShield.findUnique({ where: { profile_id: profile.id }, select: { quantity: true } })
      : Promise.resolve(null),
    profile?.id
      ? prisma.quizAttempt.count({ where: { profile_id: profile.id } })
      : Promise.resolve(0),
    // Today's goal is one round. This is the count that fills the ring.
    profile?.id
      ? prisma.quizAttempt.count({ where: { profile_id: profile.id, created_at: { gte: todayStart } } })
      : Promise.resolve(0),
    // The Daily Mystery Challenge counts too. It awards points but writes no
    // quiz_attempt row, so counting attempts alone would show a child an empty
    // ring straight after they had just finished the thing the ring asked for.
    profile?.id
      ? prisma.pointEvent.findFirst({
          where: {
            profile_id: profile.id,
            created_at: { gte: todayStart },
            reason: { startsWith: 'daily_challenge:' },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])

  const points = profile?.total_points ?? 0
  const streak = profile?.streak_days ?? 0
  const shields = shieldRow?.quantity ?? 0
  const neverPlayed = attemptCount === 0
  const vaultCredits = vaultResult?.creditBalance ?? 0
  const vaultBand = vaultResult?.currentBand ?? 'none'

  // Topics with at least one published question — the only ones a quiz CTA may
  // point at. Everything child-facing reads status='published' only.
  const quizableTopicIds = new Set(
    topicRows.filter((t) => t._count.quiz_questions > 0).map((t) => t.id),
  )

  // Spaced-repetition reviews due today — only surface published topics that
  // still have a quiz to replay.
  const revisitDue = dueReviews
    .filter((r) => r.topic?.is_published && quizableTopicIds.has(r.topic.id))
    .map((r) => ({
      id: r.topic!.id,
      title: r.topic!.title,
      subject: r.topic!.subject.name,
    }))

  const firstAssigned = assignedMissions.find((m) => m.topic)
  const nextAction = pickNextAction({
    assigned: firstAssigned?.topic
      ? {
          topicId: firstAssigned.topic.id,
          topicTitle: firstAssigned.topic.title,
          subject: firstAssigned.topic.subject.name,
        }
      : null,
    revisit: revisitDue[0] ?? null,
    subjects: curriculumSubjects,
    quizableTopicIds,
    neverPlayed,
  })

  const goalMet = roundsToday > 0 || dailyChallengeToday !== null

  return (
    <section className="space-y-4">
      <StreakPing />
      {unseenLink && (
        <NewParentLinkNotice parentName={unseenLink.parent.display_name} />
      )}

      {/* ── Name + stat strip ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Hi {displayName}</h1>
          {yearGroup && (
            <p className="mt-0.5 text-sm text-muted">
              {yearGroup.display} · {yearGroup.keyStage}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted tabular-nums">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-points-gold-700" aria-hidden />
              {streak} day streak
            </span>
          )}
          {points > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-points-gold-700" aria-hidden />
              {points.toLocaleString()} pts
            </span>
          )}
          {collectionCount > 0 && (
            <Link href="/collection" className="inline-flex items-center gap-1 hover:text-ink">
              <Layers className="w-3.5 h-3.5" aria-hidden />
              {collectionCount} card{collectionCount !== 1 ? 's' : ''}
            </Link>
          )}
          {shields > 0 && (
            <span className="inline-flex items-center gap-1" title="Each shield keeps your streak alive if you miss a day">
              <Shield className="w-3.5 h-3.5 text-explorer" aria-hidden />
              {shields} shield{shields !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── The one thing to do next ────────────────────────────────────── */}
      {nextAction ? (
        <Link
          href={nextAction.href}
          className="block rounded-3xl px-5 py-6 text-center transition-transform active:scale-[0.99]"
          style={{ background: 'linear-gradient(160deg, #6C9EFF 0%, #7C5CE0 100%)' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            {nextAction.kicker}
          </p>
          <p className="mt-1.5 font-heading text-2xl font-extrabold leading-tight text-white">
            {nextAction.title}
          </p>
          <p className="mt-1 text-xs text-white/80">{nextAction.subtitle}</p>
          <span className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white px-6 font-heading text-base font-extrabold text-[#23324D]">
            {nextAction.cta}
          </span>
        </Link>
      ) : (
        <Link
          href="/daily-challenge"
          className="block rounded-3xl px-5 py-6 text-center transition-transform active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, #FFE3A3 0%, #FFD43B 100%)' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#7a5b00' }}>
            Every topic done
          </p>
          <p className="mt-1.5 font-heading text-2xl font-extrabold leading-tight" style={{ color: '#3d2e00' }}>
            Daily Mystery Challenge
          </p>
          <p className="mt-1 text-xs" style={{ color: '#7a5b00' }}>3 fresh questions, every day</p>
          <span className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-surface px-6 font-heading text-base font-extrabold" style={{ color: '#3d2e00' }}>
            Play →
          </span>
        </Link>
      )}

      {/* ── Today's goal: one round ─────────────────────────────────────── */}
      <DailyGoalRing done={goalMet} streak={streak} />

      {/* Offered as soon as the child has finished a round, not at streak >= 2. */}
      {!neverPlayed && <StreakReminderPrompt />}

      {/* ── Daily challenge (secondary once there is a topic to do) ─────── */}
      {nextAction && (
        <Link
          href="/daily-challenge"
          className="flex items-center gap-3 rounded-2xl border border-points-gold/40 bg-points-gold/10 px-4 py-3 transition-colors hover:bg-points-gold/15"
        >
          <Star className="w-5 h-5 flex-none text-points-gold-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Daily Mystery Challenge</p>
            <p className="text-xs text-muted">3 fresh questions · bonus points</p>
          </div>
          <span className="flex-none text-xs font-bold text-points-gold-700">Play →</span>
        </Link>
      )}

      {/* ── Reward Vault — our best asset, so it sits above the small print ─ */}
      <Link
        href="/vault"
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
          vaultCredits > 0
            ? 'border-2 border-correct/50 bg-correct/10 hover:bg-correct/15'
            : 'border border-brand/20 bg-brand/5 hover:bg-brand/10'
        }`}
      >
        <Gift className={`w-5 h-5 flex-none ${vaultCredits > 0 ? 'text-correct' : 'text-brand'}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Reward Vault</p>
          <p className="text-xs text-muted">
            {vaultCredits > 0
              ? `${vaultCredits} reward${vaultCredits !== 1 ? 's' : ''} ready to claim`
              : vaultBand !== 'none'
                ? 'Keep going to unlock your next reward'
                : 'Real rewards for real progress'}
          </p>
        </div>
        <span className="flex-none text-xs font-bold text-brand">Open →</span>
      </Link>

      {/* ── Everything else, in one row ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { href: '/missions',    label: 'Missions',  Icon: Target },
          { href: '/leaderboard', label: 'Family',    Icon: Trophy },
          { href: '/customise',   label: 'Customise', Icon: PencilLine },
        ].map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border border-black/5 bg-surface px-2 py-3 text-center shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <Icon className="w-4 h-4 text-muted" aria-hidden />
            <span className="font-heading text-xs font-semibold text-ink">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── More topics to revisit, if SM-2 queued several ──────────────── */}
      {revisitDue.length > 1 && (
        <details className="rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            <RefreshCw className="mr-1.5 inline w-3.5 h-3.5 text-explorer" aria-hidden />
            {revisitDue.length - 1} more ready for a replay
          </summary>
          <ul className="mt-2 space-y-1.5">
            {revisitDue.slice(1).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/topics/${t.id}/quiz`}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-black/[0.03]"
                >
                  <span className="truncate font-semibold text-ink">{t.title}</span>
                  <span className="flex-none text-xs font-bold text-explorer">Replay →</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ── Other focus topics set by a parent ──────────────────────────── */}
      {assignedMissions.length > 1 && (
        <div className="rounded-2xl border border-points-gold/40 bg-points-gold/8 px-4 py-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-points-gold-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" aria-hidden /> Also set by your parent
          </p>
          <ul className="space-y-1.5">
            {assignedMissions.slice(1).map((m) => m.topic && (
              <li key={m.id}>
                <Link
                  href={`/topics/${m.topic.id}/learn`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-3 py-2 transition-colors hover:bg-surface"
                >
                  <span className="truncate text-sm font-semibold text-ink">{m.topic.title}</span>
                  <span className="flex-none text-xs font-bold text-brand">Start →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Curriculum map ──────────────────────────────────────────────── */}
      {curriculumSubjects.length > 0 ? (
        <ChildCurriculumMap
          subjects={curriculumSubjects}
          displayName={displayName}
          yearLabel={yearGroup?.display ?? profile?.year_group_label ?? 'Year'}
          streak={streak}
          points={points}
        />
      ) : topicRows.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-10 h-10 text-muted" aria-hidden />}
          heading="Your first topics are being prepared"
          body="Topics appear here once they pass all quality checks. New content is added across all five subjects as it clears the pipeline."
          action={
            <Link
              href="/help/how-decifer-works"
              className="inline-flex h-10 items-center rounded-xl border border-brand/30 px-5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
            >
              How Decifer works →
            </Link>
          }
        />
      ) : null}
    </section>
  )
}
