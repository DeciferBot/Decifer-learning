// Child dashboard — "What should I do next?"
// Shows published topics for the child's year group grouped by subject.

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { EmptyState } from '@/components/ui/EmptyState'
import { StreakPing } from './StreakPing'
import { getVaultStatus } from '@/lib/vault/status'

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
}

const SUBJECT_EMOJI: Record<string, string> = {
  Maths: '🔢',
  English: '📖',
  Science: '🔬',
}

const SUBJECT_ORDER = ['Maths', 'English', 'Science']

export default async function ChildDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const displayName = profile?.display_name ?? (user ? getUserDisplayName(user) : 'Explorer')
  const yearGroup = MVP_YEAR_GROUPS.find((y) => y.label === profile?.year_group_label)

  // Fire all independent DB queries in parallel — topics, collection count, vault
  const [topicRows, collectionCount, vaultResult] = await Promise.all([
    profile?.year_group_id
      ? prisma.topic.findMany({
          where: { year_group_id: profile.year_group_id, is_published: true },
          select: {
            id: true,
            title: true,
            order_index: true,
            subject: { select: { name: true, colour_token: true } },
            _count: { select: { practice_games: { where: { status: 'published' } } } },
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
  ])

  const topics: TopicRow[] = topicRows.map((t) => ({
    id: t.id,
    title: t.title,
    order_index: t.order_index,
    subjects: { name: t.subject.name, colour_token: t.subject.colour_token },
    hasPractice: t._count.practice_games > 0,
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
  const vaultCredits = vaultResult?.creditBalance ?? 0
  const vaultBand = vaultResult?.currentBand ?? 'none'

  return (
    <section className="space-y-5">
      <StreakPing />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">
            Hi {displayName} 👋
          </h1>
          {yearGroup && (
            <p className="mt-0.5 text-sm text-muted">
              {yearGroup.display} · {yearGroup.keyStage}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {points > 0 && (
            <span className="font-heading text-sm font-bold text-points-gold">
              ⭐ {points.toLocaleString()} pts
            </span>
          )}
          {streak > 0 && (
            <span className="text-xs text-muted">
              🔥 {streak} day streak
            </span>
          )}
        </div>
      </div>

      {/* ── Suggested next topic ────────────────────────────────────────── */}
      {firstTopic && (
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

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/world-map"
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
        >
          <span className="font-heading text-sm font-semibold text-ink">🗺️ World Map</span>
          <span className="text-xs text-muted">→</span>
        </Link>
        <Link
          href="/collection"
          className="flex min-h-[48px] items-center justify-between rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
        >
          <span className="font-heading text-sm font-semibold text-ink">🃏 Cards</span>
          <span className="text-xs text-muted">
            {collectionCount > 0 ? collectionCount : '—'}
          </span>
        </Link>
      </div>

      {/* ── Activities ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-muted">
          Activities
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/daily-challenge"
            className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <span className="font-heading text-sm font-semibold text-ink">🌟 Daily Challenge</span>
            <span className="text-xs text-muted">3 questions · earn points</span>
          </Link>
          <Link
            href="/missions"
            className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <span className="font-heading text-sm font-semibold text-ink">🎯 Missions</span>
            <span className="text-xs text-muted">Goals to level up</span>
          </Link>
          <Link
            href="/leaderboard"
            className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <span className="font-heading text-sm font-semibold text-ink">🏆 Leaderboard</span>
            <span className="text-xs text-muted">Family ranking</span>
          </Link>
          <Link
            href="/customise"
            className="flex min-h-[56px] flex-col justify-center rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-black/[0.03]"
          >
            <span className="font-heading text-sm font-semibold text-ink">🎨 Customise</span>
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
            <span className="text-base">🎁</span>
            <div>
              <span className="font-heading text-sm font-semibold text-brand">Reward Vault</span>
              {vaultCredits > 0 && (
                <span className="ml-2 rounded-full bg-correct/20 px-2 py-0.5 text-xs font-bold text-correct">
                  🎁 Reward ready
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
          <span className="font-heading text-sm font-semibold text-ink">🎁 Reward Vault</span>
          <span className="text-xs text-muted">→</span>
        </Link>
      )}

      {/* ── Topics by subject ───────────────────────────────────────────── */}
      {topics.length === 0 ? (
        <EmptyState
          icon="📚"
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
      ) : (
        <div className="space-y-6">
          <h2 className="font-heading text-base font-semibold text-ink">Your topics</h2>

          {subjectGroups.map(([subjectName, subjectTopics]) => {
            const colour = subjectTopics[0].subjects.colour_token
            const emoji = SUBJECT_EMOJI[subjectName] ?? '📚'
            return (
              <div key={subjectName} className="space-y-2">
                {/* Subject header */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                    style={{ backgroundColor: colour + '22' }}
                  >
                    {emoji}
                  </div>
                  <h3 className="font-heading text-sm font-bold text-ink">{subjectName}</h3>
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: colour + '22', color: colour }}
                  >
                    {subjectTopics.length} {subjectTopics.length === 1 ? 'topic' : 'topics'}
                  </span>
                </div>

                {/* Divider line in subject colour */}
                <div className="h-px w-full rounded-full opacity-30" style={{ backgroundColor: colour }} />

                {/* Topic cards */}
                <div className="space-y-2">
                  {subjectTopics.map((topic) => (
                    <article
                      key={topic.id}
                      className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm"
                    >
                      {/* Coloured header strip */}
                      <div className="h-1 w-full" style={{ backgroundColor: colour }} aria-hidden />

                      <div className="p-4">
                        <h4 className="mb-3 font-heading text-base font-bold text-ink leading-snug">
                          {topic.title}
                        </h4>

                        <div className={`grid gap-2 ${topic.hasPractice ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <Link
                            href={`/topics/${topic.id}/learn`}
                            className="flex min-h-[48px] items-center justify-center rounded-xl bg-maths/10 px-3 py-2 text-sm font-bold text-maths transition-colors hover:bg-maths/20"
                          >
                            📖 Learn
                          </Link>
                          {topic.hasPractice && (
                            <Link
                              href={`/topics/${topic.id}/practise`}
                              className="flex min-h-[48px] items-center justify-center rounded-xl bg-science/10 px-3 py-2 text-sm font-bold text-science transition-colors hover:bg-science/20"
                            >
                              ✏️ Practise
                            </Link>
                          )}
                          <Link
                            href={`/topics/${topic.id}/quiz`}
                            className="flex min-h-[48px] items-center justify-center rounded-xl bg-lightning/20 px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-lightning/30"
                          >
                            ⚡ Quiz
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
