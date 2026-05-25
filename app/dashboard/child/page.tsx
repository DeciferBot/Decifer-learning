// Child dashboard — "What should I do next?"
// Shows published topics for the child's year group with clear Learn/Practise/Quiz actions.

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { EmptyState } from '@/components/ui/EmptyState'
import { StreakPing } from './StreakPing'
import { getVaultStatus } from '@/lib/vault/status'

export const metadata = { title: 'Dashboard — Decifer Learning' }

type SubjectRow = { name: string; colour_token: string }
type TopicRow = {
  id: string
  title: string
  order_index: number
  subjects: SubjectRow
  hasPractice: boolean
}

export default async function ChildDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const displayName = profile?.display_name ?? (user ? getUserDisplayName(user) : 'Explorer')
  const yearGroup = MVP_YEAR_GROUPS.find((y) => y.label === profile?.year_group_label)

  // Fetch published topics for this child's year group, plus a flag for whether
  // each one has a published practice_game. The Practise step is hidden when
  // no game exists so "publish as available" can surface Learn+Quiz immediately.
  // RLS: topics_select_published filters to is_published=true at DB level.
  let topics: TopicRow[] = []
  if (profile?.year_group_id) {
    const rows = await prisma.topic.findMany({
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
    topics = rows.map((t) => ({
      id: t.id,
      title: t.title,
      order_index: t.order_index,
      subjects: { name: t.subject.name, colour_token: t.subject.colour_token },
      hasPractice: t._count.practice_games > 0,
    }))
  }

  // Card count for collection teaser
  let collectionCount = 0
  if (profile?.id) {
    collectionCount = await prisma.childCollection.count({ where: { profile_id: profile.id } })
  }

  const points = profile?.total_points ?? 0
  const streak = profile?.streak_days ?? 0
  const firstTopic = topics[0] ?? null

  // Vault teaser — non-blocking, graceful if vault tables not yet migrated
  let vaultCredits = 0
  let vaultBand = 'none'
  if (profile?.id) {
    try {
      const vault = await getVaultStatus(profile.id)
      vaultCredits = vault.creditBalance
      vaultBand = vault.currentBand
    } catch {
      // Vault tables may not exist yet — silently skip
    }
  }

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

      {/* ── Topics ──────────────────────────────────────────────────────── */}
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
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-heading text-base font-semibold text-ink">Your topics</h2>
            <span className="text-xs text-muted">Learn → Practise → Quiz</span>
          </div>
          {topics.map((topic) => (
            <article
              key={topic.id}
              className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm"
            >
              {/* Coloured header strip */}
              <div className="h-1 w-full" style={{ backgroundColor: topic.subjects.colour_token }} aria-hidden />

              <div className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full flex-none"
                    style={{ backgroundColor: topic.subjects.colour_token }}
                    aria-hidden
                  />
                  <span className="text-xs font-bold uppercase tracking-wide text-muted">
                    {topic.subjects.name}
                  </span>
                </div>

                <h3 className="mb-4 font-heading text-lg font-bold text-ink">{topic.title}</h3>

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
      )}
    </section>
  )
}
