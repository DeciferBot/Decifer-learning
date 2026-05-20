// Child dashboard — shows published topics for the child's year group.
// Phase 4: Learn / Practise / Quiz links for Multiplication Tables (Year 3 Maths).
// Points, streaks, world map, cards land in Phases 5–8.

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserDisplayName, MVP_YEAR_GROUPS } from '@/lib/auth/roles'
import { getCurrentProfile } from '@/lib/profile'

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

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">Hi {displayName} 👋</h1>
        {yearGroup && (
          <p className="mt-1 text-sm text-muted">
            {yearGroup.display} — {yearGroup.keyStage}
          </p>
        )}
      </div>

      {topics.length === 0 ? (
        <p className="text-sm text-muted">No topics available yet — check back soon!</p>
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
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-maths/10 px-3 py-2 text-sm font-bold text-maths transition-colors hover:bg-maths/20"
                >
                  📖 Learn
                </Link>
                <Link
                  href={`/topics/${topic.id}/practise`}
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-science/10 px-3 py-2 text-sm font-bold text-science transition-colors hover:bg-science/20"
                >
                  ✏️ Practise
                </Link>
                <Link
                  href={`/topics/${topic.id}/quiz`}
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-lightning/20 px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-lightning/30"
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
