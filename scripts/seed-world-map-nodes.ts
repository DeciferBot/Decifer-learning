/**
 * seed-world-map-nodes.ts
 *
 * 1. Normalises any existing world_map_nodes where x_pos or y_pos > 1
 *    (old entries were accidentally stored as 0–100 instead of 0–1).
 * 2. Auto-generates grid positions for every published topic that has
 *    no world_map_node entry yet.
 *
 * Grid layout: up to 4 columns, rows as needed. Positions use 0–1 scale
 * (the page multiplies by 100 to get CSS percentages).
 *
 * Idempotent — safe to re-run at any time.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-world-map-nodes.ts
 */

import { prisma } from '../lib/prisma'

// ─── Position grid ───────────────────────────────────────────────────────────

function gridPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return []

  const cols = Math.min(4, count)
  const rows = Math.ceil(count / cols)
  const positions: Array<{ x: number; y: number }> = []

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    // x: spread from 0.1 to 0.9 across cols
    const x = cols === 1 ? 0.5 : 0.1 + (col / (cols - 1)) * 0.8
    // y: spread from 0.15 to 0.85 across rows
    const y = rows === 1 ? 0.5 : 0.15 + (row / (rows - 1)) * 0.7
    positions.push({ x: parseFloat(x.toFixed(4)), y: parseFloat(y.toFixed(4)) })
  }

  return positions
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Normalise existing entries stored in 0–100 scale
  const badNodes = await prisma.worldMapNode.findMany({
    where: { OR: [{ x_pos: { gt: 1 } }, { y_pos: { gt: 1 } }] },
  })

  if (badNodes.length > 0) {
    console.log(`Normalising ${badNodes.length} nodes from 0–100 scale → 0–1 scale`)
    for (const node of badNodes) {
      await prisma.worldMapNode.update({
        where: { id: node.id },
        data: {
          x_pos: parseFloat((node.x_pos / 100).toFixed(4)),
          y_pos: parseFloat((node.y_pos / 100).toFixed(4)),
        },
      })
    }
  } else {
    console.log('No scale-normalisation needed.')
  }

  // 2. Find every published topic without a world_map_node
  const allZones = await prisma.zone.findMany({
    include: {
      topics: {
        where: { is_published: true },
        orderBy: { order_index: 'asc' },
        select: { id: true, title: true },
      },
    },
  })

  let created = 0
  let skipped = 0

  for (const zone of allZones) {
    if (zone.topics.length === 0) continue

    // Get existing node topic IDs for this zone
    const existingNodes = await prisma.worldMapNode.findMany({
      where: { zone_id: zone.id },
      select: { topic_id: true, x_pos: true, y_pos: true },
    })
    const existingTopicIds = new Set(existingNodes.map((n) => n.topic_id))

    const missingTopics = zone.topics.filter((t) => !existingTopicIds.has(t.id))
    if (missingTopics.length === 0) {
      skipped += zone.topics.length
      continue
    }

    // Generate positions for ALL topics in the zone so the grid is consistent,
    // then only insert the missing ones.
    const allPositions = gridPositions(zone.topics.length)

    for (let i = 0; i < zone.topics.length; i++) {
      const topic = zone.topics[i]
      if (existingTopicIds.has(topic.id)) continue

      const pos = allPositions[i]
      // Unlock rule: first topic in zone is always available; the rest unlock
      // after the previous topic in order.
      const prevTopic = i > 0 ? zone.topics[i - 1] : null

      await prisma.worldMapNode.create({
        data: {
          zone_id: zone.id,
          topic_id: topic.id,
          x_pos: pos.x,
          y_pos: pos.y,
          unlocked_by_topic_id: prevTopic?.id ?? null,
        },
      })
      created++
    }
  }

  console.log(`Done. Created ${created} new nodes, ${skipped} topics already had nodes.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
