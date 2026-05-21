import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { ZoneMap, type ZoneNode } from '@/components/world-map/ZoneMap'
import type { NodeState } from '@/components/world-map/TopicNode'

export const metadata = { title: 'World Map — Decifer Learning' }

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

export default async function WorldMapPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile?.year_group_id) redirect('/dashboard')

  // All zones for this child's year group, with subject colour
  const zones = await prisma.zone.findMany({
    where: { year_group_id: profile.year_group_id },
    include: {
      subject: { select: { name: true, colour_token: true } },
    },
    orderBy: { name: 'asc' },
  })

  // All world_map_nodes for those zones, with topic title
  const zoneIds = zones.map((z) => z.id)
  const nodes = await prisma.worldMapNode.findMany({
    where: { zone_id: { in: zoneIds } },
    include: {
      topic: { select: { id: true, title: true } },
    },
  })

  // Completed topics for this profile
  const progress = await prisma.topicProgress.findMany({
    where: { profile_id: profile.id, status: 'completed' },
    select: { topic_id: true },
  })
  const completedSet = new Set(progress.map((p) => p.topic_id))

  // Group nodes by zone for efficient lookup
  const nodesByZone = new Map<string, typeof nodes>()
  for (const node of nodes) {
    const existing = nodesByZone.get(node.zone_id) ?? []
    existing.push(node)
    nodesByZone.set(node.zone_id, existing)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">World Map</h1>
          <p className="mt-1 text-sm text-muted">Your learning adventure</p>
        </div>
        <Link
          href="/dashboard/child"
          className="text-sm font-bold text-muted hover:text-ink"
        >
          ← Home
        </Link>
      </div>

      <div className="space-y-4">
        {zones.map((zone) => {
          const zoneNodes = nodesByZone.get(zone.id) ?? []
          const colour = zone.subject.colour_token ?? '#6C9EFF'

          const mappedNodes: ZoneNode[] = zoneNodes.map((node) => ({
            id: node.id,
            topicId: node.topic_id,
            topicTitle: node.topic.title,
            state: computeNodeState(node.topic_id, node.unlocked_by_topic_id, completedSet),
            href: `/topics/${node.topic_id}/learn`,
            xPct: node.x_pos * 100,
            yPct: node.y_pos * 100,
          }))

          const allCompleted =
            mappedNodes.length > 0 && mappedNodes.every((n) => n.state === 'completed')

          return (
            <ZoneMap
              key={zone.id}
              zoneId={zone.id}
              zoneName={zone.name}
              theme={zone.theme}
              subjectColor={colour}
              nodes={mappedNodes}
              allCompleted={allCompleted}
            />
          )
        })}
      </div>
    </div>
  )
}
