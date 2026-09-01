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
// strip carries the numbers, and everything else sits in a three-across tile
// grid near the bottom. The tab bar holds four: Learn (this screen), Games,
// Cards, Profile.
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
import { displayedStreak } from '@/lib/streak'
import { Layers, Star, Target, Trophy, PencilLine, BookOpen, Gift, Flame, MapPin, RefreshCw, Shield, MapFold, Telescope, ClipboardList } from '@/components/ui/icons'
import { Deci } from '@/components/ui/Deci'
import { buttonClasses } from '@/components/ui/Button'

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
  const shields = shieldRow?.quantity ?? 0
  // What the streak is actually worth right now. The stored number is only
  // corrected on the next round, so reading it raw would tell a child who last
  // played a fortnight ago that they still have a 9 day streak.
  const streak = displayedStreak({
    lastRoundOn: profile?.last_round_on ?? null,
    streakDays: profile?.streak_days ?? 0,
    freezesAvailable: shieldRow?.quantity ?? 0,
    now: new Date(),
  })
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

  // Today's round is done if a quiz attempt or the daily challenge landed today.
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
              {points.toLocaleString()} points
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
          className="block overflow-hidden rounded-3xl border-2 border-sea-deep/30 bg-gradient-to-b from-sea to-[#2A82BC] px-5 pb-5 pt-6 shadow-clay transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
        >
          <div className="flex items-end gap-2.5 text-left">
            <Deci mood="happy" size={52} className="flex-none drop-shadow-sm" />
            <div className="mb-1 min-w-0 flex-1 rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 shadow-[0_2px_0_rgba(15,58,92,0.18)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sea">{nextAction.kicker}</p>
              <p className="font-heading text-lg font-extrabold leading-tight text-ink">{nextAction.title}</p>
              <p className="mt-0.5 text-xs text-muted">{nextAction.subtitle}</p>
            </div>
          </div>
          <span className={buttonClasses('primary', 'md', 'mt-4 w-full pointer-events-none')}>
            {nextAction.cta}
          </span>
        </Link>
      ) : (
        <Link
          href="/daily-challenge"
          className="block overflow-hidden rounded-3xl border-2 border-points-gold/50 bg-points-gold/15 px-5 pb-5 pt-6 shadow-clay transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
        >
          <div className="flex items-end gap-2.5 text-left">
            <Deci mood="cheering" size={52} className="flex-none" />
            <div className="mb-1 min-w-0 flex-1 rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 shadow-[0_2px_0_rgba(15,58,92,0.15)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-points-gold-700">Every topic done</p>
              <p className="font-heading text-lg font-extrabold leading-tight text-ink">Daily Mystery Challenge</p>
              <p className="mt-0.5 text-xs text-muted">3 fresh questions, every day</p>
            </div>
          </div>
          <span className={buttonClasses('primary', 'md', 'mt-4 w-full pointer-events-none')}>
            Play &rarr;
          </span>
        </Link>
      )}

      {/* ── Today's goal: one round ─────────────────────────────────────── */}
      <DailyGoalRing done={goalMet} streak={streak} />

      {/* Offered as soon as the child has finished a round, not at streak >= 2. */}
      {!neverPlayed && <StreakReminderPrompt />}

      {/* ── One reward row, only when it carries news ───────────────────── */}
      {vaultCredits > 0 ? (
        <Link
          href="/vault"
          className="flex items-center gap-3 rounded-2xl border-2 border-correct/50 bg-correct/10 px-4 py-3 shadow-clay-sm transition-[transform,box-shadow,background-color] duration-fast ease-out hover:bg-correct/15 active:translate-y-[2px] active:shadow-clay-pressed motion-reduce:transition-none motion-reduce:active:translate-y-0"
        >
          <Gift className="w-5 h-5 flex-none text-correct-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Reward Vault</p>
            <p className="text-xs text-muted">{vaultCredits} reward{vaultCredits !== 1 ? 's' : ''} ready to claim</p>
          </div>
          <span className="flex-none text-xs font-bold text-correct-700">Open &rarr;</span>
        </Link>
      ) : nextAction ? (
        <Link
          href="/daily-challenge"
          className="flex items-center gap-3 rounded-2xl border-2 border-points-gold/40 bg-points-gold/10 px-4 py-3 shadow-clay-sm transition-[transform,box-shadow,background-color] duration-fast ease-out hover:bg-points-gold/15 active:translate-y-[2px] active:shadow-clay-pressed motion-reduce:transition-none motion-reduce:active:translate-y-0"
        >
          <Star className="w-5 h-5 flex-none text-points-gold-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Daily Mystery Challenge</p>
            <p className="text-xs text-muted">3 fresh questions &middot; bonus points</p>
          </div>
          <span className="flex-none text-xs font-bold text-points-gold-700">Play &rarr;</span>
        </Link>
      ) : null}

      {/* ── Everywhere else, three across ───────────────────────────────────
          Three columns rather than four, so each tile is wide enough for a
          readable word and a finger. Games moved out to the tab bar; the world
          map, Explore and Exams moved in, because the tab bar was carrying
          seven tabs on a 375px phone. */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: '/world-map',   label: 'Subjects',  Icon: MapFold },
          { href: '/explore',     label: 'Explore',   Icon: Telescope },
          { href: '/exam',        label: 'Exams',     Icon: ClipboardList },
          { href: '/missions',    label: 'Missions',  Icon: Target },
          { href: '/leaderboard', label: 'Family',    Icon: Trophy },
          { href: '/customise',   label: 'Customise', Icon: PencilLine },
        ].map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-black/5 bg-surface px-2 py-4 text-center shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <Icon className="w-6 h-6 text-brand-700" aria-hidden />
            <span className="font-heading text-sm font-semibold text-ink">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Everything extra, in one closed drawer ──────────────────────── */}
      {(revisitDue.length > 1 || assignedMissions.length > 1) && (
        <details className="rounded-2xl border-2 border-black/8 bg-surface px-4 py-3 shadow-clay-sm">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            <RefreshCw className="mr-1.5 inline w-3.5 h-3.5 text-sea" aria-hidden />
            More for you ({(revisitDue.length > 1 ? revisitDue.length - 1 : 0) + (assignedMissions.length > 1 ? assignedMissions.length - 1 : 0)})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {assignedMissions.slice(1).map((m) => m.topic && (
              <li key={m.id}>
                <Link
                  href={`/topics/${m.topic.id}/learn`}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-black/[0.03]"
                >
                  <span className="truncate font-semibold text-ink">
                    <MapPin className="mr-1 inline w-3 h-3 text-points-gold-700" aria-hidden />
                    {m.topic.title}
                  </span>
                  <span className="flex-none text-xs font-bold text-brand-700">Set by your parent &rarr;</span>
                </Link>
              </li>
            ))}
            {revisitDue.slice(1).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/topics/${t.id}/quiz`}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-black/[0.03]"
                >
                  <span className="truncate font-semibold text-ink">{t.title}</span>
                  <span className="flex-none text-xs font-bold text-sea">Replay &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
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
          heading="Your first topics are on their way"
          body="New topics show up here when they are ready. Check back soon!"
          action={
            <Link
              href="/help/how-decifer-works"
              className="inline-flex h-10 items-center rounded-xl border border-brand/30 px-5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand/5"
            >
              How Decifer works →
            </Link>
          }
        />
      ) : null}
    </section>
  )
}
