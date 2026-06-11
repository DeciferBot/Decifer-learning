export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { ZoneMap, type ZoneTopic } from '@/components/world-map/ZoneMap'
import { MapFold } from '@/components/ui/icons'

export const metadata = { title: 'World Map — Decifer Learning' }

export const revalidate = 60

function computeCheckpointTopicId(
  topicIds: string[],
  completedSet: Set<string>,
): string | null {
  const completed = topicIds.filter((id) => completedSet.has(id))
  const total = topicIds.length
  if (completed.length === 0 || completed.length === total) return null
  if (completed.length % 3 !== 0) return null
  return completed[completed.length - 1]
}

export default async function WorldMapPage() {
  const supabase = createSupabaseServerClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile?.year_group_id) redirect('/dashboard')

  const [zones, progress, unitCounts] = await Promise.all([
    prisma.zone.findMany({
      where: { year_group_id: profile.year_group_id },
      include: {
        subject: { select: { name: true, colour_token: true } },
        topics: {
          where: { is_published: true },
          orderBy: { order_index: 'asc' },
          select: { id: true, title: true, order_index: true, quiz_optional: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.topicProgress.findMany({
      where: { profile_id: profile.id, status: 'completed' },
      select: { topic_id: true },
    }),
    prisma.curriculumUnit.groupBy({
      by: ['topic_id'],
      where: { topic_id: { not: null } },
      _count: { id: true },
    }),
  ])

  const completedSet = new Set(progress.map((p) => p.topic_id))
  const chapterCountByTopic = new Map(
    unitCounts
      .filter((r) => r.topic_id !== null)
      .map((r) => [r.topic_id as string, r._count.id])
  )

  const zonesWithTopics = zones.filter((z) => z.topics.length > 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">World Map</h1>
        <p className="mt-1 text-sm text-muted">Your learning adventure</p>
      </div>

      {zonesWithTopics.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface px-5 py-10 text-center shadow-sm">
          <div className="flex justify-center"><MapFold className="w-8 h-8 text-muted" aria-hidden /></div>
          <p className="mt-3 font-heading text-base font-bold text-ink">Your world map is being built</p>
          <p className="mt-1 text-sm text-muted">Check back soon — your zones will appear here.</p>
        </div>
      )}

      <div className="space-y-4">
        {zonesWithTopics.map((zone) => {
          const colour = zone.subject.colour_token ?? '#6C9EFF'

          const topics: ZoneTopic[] = zone.topics.map((t, i) => {
            const completed = completedSet.has(t.id)
            // first topic always available; subsequent unlock after previous complete
            const prevCompleted = i === 0 || completedSet.has(zone.topics[i - 1].id)
            const state = completed ? 'completed' : prevCompleted ? 'available' : 'locked'
            return {
              id: t.id,
              title: t.title,
              state,
              href: `/topics/${t.id}/learn`,
              quizOptional: t.quiz_optional,
              chapterCount: chapterCountByTopic.get(t.id) ?? 0,
            }
          })

          const allCompleted = topics.length > 0 && topics.every((t) => t.state === 'completed')
          const checkpointTopicId = computeCheckpointTopicId(zone.topics.map((t) => t.id), completedSet)

          return (
            <ZoneMap
              key={zone.id}
              zoneId={zone.id}
              zoneName={zone.name}
              subjectName={zone.subject.name}
              theme={zone.theme}
              subjectColor={colour}
              topics={topics}
              allCompleted={allCompleted}
              checkpointTopicId={checkpointTopicId}
            />
          )
        })}
      </div>
    </div>
  )
}
