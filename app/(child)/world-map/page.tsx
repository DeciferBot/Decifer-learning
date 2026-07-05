export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { ZoneMap, type ZoneNode } from '@/components/world-map/ZoneMap'
import type { NodeState } from '@/components/world-map/TopicNode'
import { MapFold, Swords, ArrowRight } from '@/components/ui/icons'
import Link from 'next/link'

export const metadata = { title: 'World Map — Decifer Learning' }

export const revalidate = 60

function computeNodeState(
  topicId: string,
  unlockedByTopicId: string | null,
  completedSet: Set<string>,
): NodeState {
  if (completedSet.has(topicId)) return 'completed'
  if (unlockedByTopicId === null) return 'available'
  if (completedSet.has(unlockedByTopicId)) return 'available'
  return 'locked'
}

function computeCheckpointTopicId(topicIds: string[], completedSet: Set<string>): string | null {
  const completed = topicIds.filter((id) => completedSet.has(id))
  if (completed.length === 0 || completed.length === topicIds.length) return null
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
        // fetch published topics ordered by index (for fallback grid)
        topics: {
          where: { is_published: true },
          orderBy: { order_index: 'asc' },
          select: { id: true, title: true, quiz_optional: true },
        },
        world_map_nodes: {
          include: { topic: { select: { id: true, title: true, quiz_optional: true } } },
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
    unitCounts.filter((r) => r.topic_id !== null).map((r) => [r.topic_id as string, r._count.id])
  )

  const zonesWithContent = zones.filter((z) => z.topics.length > 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">World Map</h1>
        <p className="mt-1 text-sm text-muted">Your learning adventure</p>
      </div>

      {/* Decifer Live — Kahoot-style quiz battle */}
      <Link
        href="/play"
        className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand to-ember-bright px-5 py-4 text-white shadow-sm transition hover:opacity-95"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface/20">
          <Swords className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="font-heading text-base font-extrabold leading-tight">Quiz Battle</p>
          <p className="text-sm text-white/85">Race your friends in a live quiz!</p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
      </Link>

      {zonesWithContent.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-surface px-5 py-10 text-center shadow-sm">
          <div className="flex justify-center"><MapFold className="w-8 h-8 text-muted" aria-hidden /></div>
          <p className="mt-3 font-heading text-base font-bold text-ink">Your world map is being built</p>
          <p className="mt-1 text-sm text-muted">Check back soon — your zones will appear here.</p>
        </div>
      )}

      <div className="space-y-4">
        {zonesWithContent.map((zone) => {
          const colour = zone.subject.colour_token ?? '#6C9EFF'
          const nodeMap = new Map(zone.world_map_nodes.map((n) => [n.topic_id, n]))

          // Nodes render in order_index order; ZoneMap lays them out as a
          // serpentine path, so DB x/y positions are no longer needed here.
          const mappedNodes: ZoneNode[] = zone.topics.map((t, i) => {
            const dbNode = nodeMap.get(t.id)
            return {
              id: dbNode?.id ?? t.id,
              topicId: t.id,
              topicTitle: t.title,
              state: computeNodeState(t.id, dbNode?.unlocked_by_topic_id ?? (i > 0 ? zone.topics[i - 1].id : null), completedSet),
              href: `/topics/${t.id}/learn`,
              quizOptional: t.quiz_optional,
              chapterCount: chapterCountByTopic.get(t.id) ?? 0,
            }
          })

          const allCompleted = mappedNodes.length > 0 && mappedNodes.every((n) => n.state === 'completed')
          const checkpointTopicId = computeCheckpointTopicId(zone.topics.map((t) => t.id), completedSet)

          return (
            <ZoneMap
              key={zone.id}
              zoneId={zone.id}
              zoneName={zone.name}
              subjectName={zone.subject.name}
              theme={zone.theme}
              subjectColor={colour}
              nodes={mappedNodes}
              allCompleted={allCompleted}
              checkpointTopicId={checkpointTopicId}
            />
          )
        })}
      </div>
    </div>
  )
}
