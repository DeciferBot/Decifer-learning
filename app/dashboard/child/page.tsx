// Child dashboard — "What should I do next?"
// Shows published topics for the child's year group grouped by subject.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PushNotificationButton } from '@/components/ui/PushNotificationButton'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getChildGate } from '@/lib/child-gate'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChildCurriculumMap } from '@/components/child/ChildCurriculumMap'
import { getCurriculumProgress } from '@/lib/parent-dashboard'
import { StreakPing } from './StreakPing'
import { getVaultStatus } from '@/lib/vault/status'
import { NewParentLinkNotice } from './NewParentLinkNotice'
import { MapFold, Layers, Star, Target, Trophy, PencilLine, Microscope, BookOpen, Gift, Flame, Zap, MapPin, RefreshCw, Shield, Compass } from '@/components/ui/icons'

export const metadata = { title: 'Dashboard — Decifer Learning' }

// Re-render at most once per 60 s; stale data served instantly from cache.
// Points/streak come from the profile row which updates on quiz submit, so
// a 60 s window is fine for the dashboard teaser values.
export const revalidate = 60

type SubjectRow = { name: string; colour_token: string }
type TopicRow = {
  id: string
  title: string
  order_index: number
  subjects: SubjectRow
  hasPractice: boolean
  hasQuiz: boolean
}

import type { ComponentType, SVGProps } from 'react'
type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
const SUBJECT_ICON: Record<string, IconComponent> = {
  Maths:   Target,
  English: PencilLine,
  Science: Microscope,
}

const SUBJECT_ORDER = ['Maths', 'English', 'Science']

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

  // Fire all independent DB queries in parallel — topics, collection count, vault, assigned focus topics, curriculum progress, spaced-repetition reviews due, streak shields, quiz-attempt count
  const [topicRows, collectionCount, vaultResult, assignedMissions, curriculumSubjects, dueReviews, shieldRow, attemptCount] = await Promise.all([
    profile?.year_group_id
      ? prisma.topic.findMany({
          where: { year_group_id: profile.year_group_id, is_published: true },
          select: {
            id: true,
            title: true,
            order_index: true,
            subject: { select: { name: true, colour_token: true } },
            _count: { select: { practice_games: { where: { status: 'published' } }, quiz_questions: { where: { status: 'published' } } } },
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
  ])

  const topics: TopicRow[] = topicRows.map((t) => ({
    id: t.id,
    title: t.title,
    order_index: t.order_index,
    subjects: { name: t.subject.name, colour_token: t.subject.colour_token },
    hasPractice: t._count.practice_games > 0,
    hasQuiz: t._count.quiz_questions > 0,
  }))

  // Group by subject, preserving canonical order
  const subjectMap = new Map<string, TopicRow[]>()
  for (const topic of topics) {
    const name = topic.subjects.name
    if (!subjectMap.has(name)) subjectMap.set(name, [])
    subjectMap.get(name)!.push(topic)
  }
  const subjectGroups = [...subjectMap.entries()].sort(([a], [b]) => {
    const ia = SUBJECT_ORDER.indexOf(a)
    const ib = SUBJECT_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const firstTopic = topics[0] ?? null
  const points = profile?.total_points ?? 0
  const streak = profile?.streak_days ?? 0

  // Build a map of topicId → hasPractice for the curriculum map
  const practiceMap = new Map<string, boolean>(
    topicRows.map((t) => [t.id, t._count.practice_games > 0])
  )
  const vaultCredits = vaultResult?.creditBalance ?? 0
  const vaultBand = vaultResult?.currentBand ?? 'none'

  // Spaced-repetition reviews due today — only surface published topics that
  // still have a quiz to replay. SM-2 schedules these; this is where they finally
  // become visible to the child (previously computed but never shown).
  const hasQuizMap = new Map<string, boolean>(topicRows.map((t) => [t.id, t._count.quiz_questions > 0]))
  const revisitDue = dueReviews
    .filter((r) => r.topic?.is_published && hasQuizMap.get(r.topic.id))
    .map((r) => ({
      id: r.topic!.id,
      title: r.topic!.title,
      subject: r.topic!.subject.name,
      colour: r.topic!.subject.colour_token,
    }))

  const shields = shieldRow?.quantity ?? 0
  const neverPlayed = attemptCount === 0

  // Subject-breadth nudge: when the child has real momentum in exactly one
  // subject, gently invite them into another (Maths dominates play overall).
  const subjectsWithProgress = curriculumSubjects.filter((s) => s.completedCount > 0)
  const totalCompleted = curriculumSubjects.reduce((sum, s) => sum + s.completedCount, 0)
  const breadthTarget =
    subjectsWithProgress.length === 1 && totalCompleted >= 2
      ? curriculumSubjects.find((s) => s.completedCount === 0 && s.topics.length > 0)
      : undefined
  const breadthFromSubject = subjectsWithProgress[0]?.subjectName ?? ''

  return (
    <section className="space-y-5">
      <StreakPing />
      {unseenLink && (
        <NewParentLinkNotice parentName={unseenLink.parent.display_name} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">
            Hi {displayName}
          </h1>
          {yearGroup && (
            <p className="mt-0.5 text-sm text-muted">
              {yearGroup.display} · {yearGroup.keyStage}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {points > 0 && (
            <span className="inline-flex items-center gap-1 font-heading text-sm font-bold text-points-gold-700">
              <Star className="w-3.5 h-3.5" aria-hidden /> {points.toLocaleString()} pts
            </span>
          )}
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Flame className="w-3.5 h-3.5" aria-hidden /> {streak} day streak
            </span>
          )}
          {shields > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-explorer" title="Each shield saves you from losing a heart in a quiz">
              <Shield className="w-3.5 h-3.5" aria-hidden /> {shields} shield{shields !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Parent-assigned focus topics ───────────────────────────────── */}
      {assignedMissions.length > 0 && (
        <div className="rounded-2xl border-2 border-points-gold/40 bg-points-gold/8 px-4 py-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-points-gold-700 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" aria-hidden /> Focus topics from your parent
          </p>
          <ul className="space-y-1.5">
            {assignedMissions.map((m) => m.topic && (
              <li key={m.id}>
                <Link
                  href={`/topics/${m.topic.id}/learn`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2.5 hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-full"
                      style={{ backgroundColor: m.topic.subject.colour_token }}
                    />
                    <span className="truncate text-sm font-semibold text-ink">{m.topic.title}</span>
                    <span className="flex-none text-xs text-muted">{m.topic.subject.name}</span>
                  </div>
                  <span className="flex-none text-xs font-bold text-brand">Start →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── First-time welcome — make the very first action unmistakable ─── */}
      {neverPlayed && firstTopic && firstTopic.hasQuiz && (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-brand/40 bg-brand/8 px-4 py-3">
          <span className="text-xl" aria-hidden>👋</span>
          <p className="text-sm font-semibold text-ink">
            New here? Tap below to play your first quiz and win your first Discovery Card.
          </p>
        </div>
      )}

      {/* ── Your card is waiting ─────────────────────────────────────────── */}
      {firstTopic && firstTopic.hasQuiz && (
        <Link
          href={`/topics/${firstTopic.id}/quiz`}
          className="block rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', border: '2px solid rgba(255,193,7,0.3)' }}
        >
          <div className="flex items-center gap-4 px-5 py-4">
            {/* Card visual */}
            <div className="relative flex-none">
              <div
                className="w-14 h-20 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #FFD43B22, #FFC10722)', border: '2px solid rgba(255,193,7,0.5)' }}
              >
                <Gift className="w-7 h-7" style={{ color: '#FFD43B' }} aria-hidden />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FFD43B] flex items-center justify-center">
                <span className="text-[8px] font-black text-black">!</span>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#FFD43B' }}>
                Your card is waiting
              </p>
              <p className="font-heading font-extrabold text-white text-base leading-snug">
                Pass the {firstTopic.title} quiz
              </p>
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Score 70%+ → guaranteed Discovery Card <Gift className="w-3.5 h-3.5" aria-hidden />
              </p>
            </div>

            {/* Arrow */}
            <div
              className="flex-none w-9 h-9 rounded-full flex items-center justify-center font-bold text-black text-base"
              style={{ background: '#FFD43B' }}
            >
              →
            </div>
          </div>

          {/* Progress bar — shows collection momentum */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Your collection
              </span>
              <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {collectionCount} card{collectionCount !== 1 ? 's' : ''} so far
              </span>
            </div>
            <div className="h-1.5 rounded-full w-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, ((collectionCount % 10) / 10) * 100)}%`,
                  background: 'linear-gradient(90deg, #FFD43B, #FFA94D)',
                }}
              />
            </div>
          </div>
        </Link>
      )}

      {/* ── Suggested next topic (no quiz available) ─────────────────────── */}
      {firstTopic && !firstTopic.hasQuiz && (
        <div className="rounded-2xl bg-brand-50 p-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand">
            Continue learning
          </p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading font-bold text-ink">{firstTopic.title}</p>
              <p className="text-xs text-muted">{firstTopic.subjects.name}</p>
            </div>
            <Link
              href={`/topics/${firstTopic.id}/learn`}
              className="flex-none flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-white transition-colors hover:bg-brand-600"
            >
              Start →
            </Link>
          </div>
        </div>
      )}

      {/* ── Time to revisit (spaced repetition) ──────────────────────────── */}
      {revisitDue.length > 0 && (
        <div className="rounded-2xl border-2 border-explorer/40 bg-explorer/8 px-4 py-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-explorer flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Time to revisit
          </p>
          <p className="-mt-1 text-xs text-muted">A quick replay locks these into your memory.</p>
          <ul className="space-y-1.5">
            {revisitDue.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/topics/${t.id}/quiz`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2.5 transition-colors hover:bg-white"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: t.colour }} />
                    <span className="truncate text-sm font-semibold text-ink">{t.title}</span>
                    <span className="flex-none text-xs text-muted">{t.subject}</span>
                  </div>
                  <span className="flex-none text-xs font-bold text-explorer">Revisit →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Daily Mystery Challenge (promoted) ───────────────────────────── */}
      <Link
        href="/daily-challenge"
        className="flex items-center gap-4 rounded-2xl px-5 py-4 transition-transform active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #FFE3A3 0%, #FFD43B 100%)' }}
      >
        <div className="flex-none flex h-11 w-11 items-center justify-center rounded-xl bg-white/40">
          <Star className="w-6 h-6" style={{ color: '#7a5b00' }} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#7a5b00' }}>Today only</p>
          <p className="font-heading text-base font-extrabold leading-snug" style={{ color: '#3d2e00' }}>
            Daily Mystery Challenge
          </p>
          <p className="mt-0.5 text-xs" style={{ color: '#7a5b00' }}>3 fresh questions · earn bonus points</p>
        </div>
        <div className="flex-none flex h-9 w-9 items-center justify-center rounded-full bg-white/50 font-bold" style={{ color: '#3d2e00' }}>
          →
        </div>
      </Link>

      {/* ── Subject-breadth nudge ────────────────────────────────────────── */}
      {breadthTarget && (
        <Link
          href={`/topics/${breadthTarget.topics[0].topicId}/learn`}
          className="flex items-center gap-3 rounded-2xl border border-science/30 bg-science/8 px-4 py-3 transition-colors hover:bg-science/15"
        >
          <Compass className="w-5 h-5 flex-none text-science" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              You&apos;re smashing {breadthFromSubject}! Ready to try {breadthTarget.subjectName}?
            </p>
            <p className="text-xs text-muted">Branch out and collect cards from a new subject.</p>
          </div>
          <span className="flex-none text-xs font-bold text-science">Try →</span>
        </Link>
      )}

      {/* ── Learning Aid Box ─────────────────────────────────────────────── */}
      <Link
        href="/explore"
        className="block relative overflow-hidden rounded-2xl px-5 py-4 transition-transform active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #0d1b3e 0%, #1a237e 50%, #0d47a1 100%)', border: '1px solid rgba(108,158,255,0.3)' }}
      >
        {/* Stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[
            { top: '15%', left: '60%' }, { top: '70%', left: '75%' },
            { top: '40%', left: '85%' }, { top: '20%', left: '90%' },
            { top: '80%', left: '55%' }, { top: '55%', left: '92%' },
          ].map((pos, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full bg-white/40" style={pos} />
          ))}
        </div>
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl flex-none">🔭</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-heading text-base font-extrabold text-white">Explore</p>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: '#FFD43B', color: '#000' }}>NEW</span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">Solar system · world atlas · human body + more</p>
            </div>
          </div>
          <div className="flex-none w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <span className="text-white font-bold">→</span>
          </div>
        </div>
      </Link>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/world-map"
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
        >
          <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1"><MapFold className="w-4 h-4" aria-hidden /> World Map</span>
          <span className="text-xs text-muted">→</span>
        </Link>
        <Link
          href="/collection"
          className="flex min-h-[48px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
        >
          <div className="flex items-center justify-between">
            <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1"><Layers className="w-4 h-4" aria-hidden /> My Cards</span>
            <span className="font-heading text-sm font-bold text-ink">
              {collectionCount > 0 ? collectionCount : '0'}
            </span>
          </div>
          <span className="mt-0.5 text-xs text-muted">Pass a quiz → win one</span>
        </Link>
      </div>

      {/* ── Activities ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-muted">
          Activities
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/missions"
            className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1"><Target className="w-4 h-4" aria-hidden /> Missions</span>
            <span className="text-xs text-muted">Goals to level up</span>
          </Link>
          <Link
            href="/leaderboard"
            className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1"><Trophy className="w-4 h-4" aria-hidden /> Leaderboard</span>
            <span className="text-xs text-muted">Family ranking</span>
          </Link>
          <Link
            href="/customise"
            className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1"><PencilLine className="w-4 h-4" aria-hidden /> Customise</span>
            <span className="text-xs text-muted">Avatar · theme · buddy</span>
          </Link>
        </div>
      </div>

      {/* ── Vault teaser ─────────────────────────────────────────────────── */}
      {vaultBand !== 'none' || vaultCredits > 0 ? (
        <Link
          href="/vault"
          className="flex min-h-[52px] items-center justify-between rounded-2xl border border-brand/20 bg-brand/5 px-5 py-3 shadow-sm transition-colors hover:bg-brand/10"
        >
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-brand" aria-hidden />
            <div>
              <span className="font-heading text-sm font-semibold text-brand">Reward Vault</span>
              {vaultCredits > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-correct/20 px-2 py-0.5 text-xs font-bold text-correct">
                  <Gift className="w-3 h-3" aria-hidden /> Reward ready
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-brand">→</span>
        </Link>
      ) : (
        <Link
          href="/vault"
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
        >
          <span className="font-heading text-sm font-semibold text-ink flex items-center gap-1"><Gift className="w-4 h-4" aria-hidden /> Reward Vault</span>
          <span className="text-xs text-muted">→</span>
        </Link>
      )}

      {/* ── Curriculum map ──────────────────────────────────────────────── */}
      {curriculumSubjects.length > 0 ? (
        <ChildCurriculumMap
          subjects={curriculumSubjects}
          displayName={displayName}
          yearLabel={yearGroup?.display ?? profile?.year_group_label ?? 'Year'}
          streak={streak}
          points={points}
          practiceMap={practiceMap}
        />
      ) : topics.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-10 h-10 text-muted" aria-hidden />}
          heading="Your first topics are being prepared"
          body="Maths content is the most complete right now. Topics appear here once they pass all quality checks."
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

      {/* ── Streak notifications opt-in ─────────────────────────────────── */}
      {streak >= 2 && (
        <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-ink">Streak reminders</p>
            <p className="text-xs text-muted">Get a nudge if your streak is at risk</p>
          </div>
          <PushNotificationButton />
        </div>
      )}
    </section>
  )
}
