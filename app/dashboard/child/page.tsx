// Child dashboard — shows published topics for the child's year group.
// Phase 5: Points, streak, and StreakPing added.

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { StreakPing } from './StreakPing'

export const metadata = { title: 'Dashboard — Decifer Learning' }

type SubjectRow = { name: string; colour_token: string }
type TopicRow = { id: string; title: string; order_index: number; subjects: SubjectRow }

export default async function ChildDashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const displayName = profile?.display_name ?? (user ? getUserDisplayName(user) : 'Explorer')
  const yearGroup = MVP_YEAR_GROUPS.find((y) => y.label === profile?.year_group_label)

  // Fetch published topics for this child's year group.
  // RLS: topics_select_published filters to is_published=true at DB level.
  let topics: TopicRow[] = []
  if (profile?.year_group_id) {
    const { data } = await supabase
      .from('topics')
      .select('id, title, order_index, subjects(name, colour_token)')
      .eq('year_group_id', profile.year_group_id)
      .eq('is_published', true)
      .order('order_index')
    topics = (data as TopicRow[] | null) ?? []
  }

  // Card count for collection teaser
  let collectionCount = 0
  if (profile?.id) {
    collectionCount = await prisma.childCollection.count({ where: { profile_id: profile.id } })
  }

  return (
    <section className="space-y-5">
      <StreakPing />
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">Hi {displayName} 👋</h1>
          {yearGroup && (
            <p className="mt-1 text-sm text-muted">
              {yearGroup.display} — {yearGroup.keyStage}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          {(profile?.total_points ?? 0) > 0 && (
            <span className="font-heading text-sm font-bold text-points-gold">
              ⭐ {profile!.total_points.toLocaleString()} pts
            </span>
          )}
          {(profile?.streak_days ?? 0) > 0 && (
            <span className="text-xs text-muted">
              🔥 {profile!.streak_days} day streak
            </span>
          )}
        </div>
      </div>

      {/* World Map entry */}
      <Link
        href="/world-map"
        className="flex min-h-[48px] items-center justify-between rounded-2xl border border-black/5 bg-surface px-5 py-3 shadow-sm transition-colors hover:bg-black/5"
      >
        <span className="font-heading font-semibold text-ink">
          🗺️ World Map
        </span>
        <span className="text-sm text-muted">Explore your zones →</span>
      </Link>

      {/* Collection teaser */}
      <Link
        href="/collection"
        className="flex min-h-[48px] items-center justify-between rounded-2xl border border-black/5 bg-surface px-5 py-3 shadow-sm transition-colors hover:bg-black/5"
      >
        <span className="font-heading font-semibold text-ink">
          🃏 My Collection
        </span>
        <span className="text-sm text-muted">
          {collectionCount > 0 ? `${collectionCount} card${collectionCount === 1 ? '' : 's'}` : 'Complete a quiz!'} →
        </span>
      </Link>

      {topics.length === 0 ? (
        <p className="text-sm text-muted">No topics yet — check back soon!</p>
      ) : (
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-ink">Your Topics</h2>
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="rounded-2xl border border-black/5 bg-surface p-5 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: topic.subjects.colour_token }}
                  aria-hidden
                />
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  {topic.subjects.name}
                </span>
              </div>

              <h3 className="mb-4 font-heading text-lg font-bold text-ink">{topic.title}</h3>

              <div className="grid grid-cols-3 gap-2">
                <Link
                  href={`/topics/${topic.id}/learn`}
                  className="flex min-h-[48px] items-center justify-center rounded-xl bg-maths/10 px-3 py-2 text-sm font-bold text-maths transition-colors hover:bg-maths/20"
                >
                  📖 Learn
                </Link>
                <Link
                  href={`/topics/${topic.id}/practise`}
                  className="flex min-h-[48px] items-center justify-center rounded-xl bg-science/10 px-3 py-2 text-sm font-bold text-science transition-colors hover:bg-science/20"
                >
                  ✏️ Practise
                </Link>
                <Link
                  href={`/topics/${topic.id}/quiz`}
                  className="flex min-h-[48px] items-center justify-center rounded-xl bg-lightning/20 px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-lightning/30"
                >
                  ⚡ Quiz
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
