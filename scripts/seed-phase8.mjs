/**
 * Phase 8 seed — world_map_nodes for published Maths topics.
 *
 * Seeds:
 *  - 1 node for Multiplication Tables (Number Jungle, Year 3 Maths)
 *  - 1 node for Algebra: Solving Linear Equations (Crystal Labyrinth, Year 7 Maths)
 *
 * Both nodes are first nodes (unlocked_by_topic_id = null) — always available.
 * x_pos = 0.5, y_pos = 0.5 (proportional 0–1, centred in the zone card container).
 *
 * Idempotent: deletes all existing world_map_nodes and re-inserts.
 *
 * Run: node --env-file=.env.local scripts/seed-phase8.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Phase 8 seed — world_map_nodes')
  console.log('══════════════════════════════════════════════\n')

  // Resolve IDs dynamically — no hardcoded UUIDs in seed logic.
  const multTopic = await prisma.topic.findFirst({
    where: { title: 'Multiplication Tables' },
    select: { id: true, zone_id: true, year_group_id: true },
  })
  if (!multTopic) throw new Error('Multiplication Tables topic not found — run Phase 4 seed first')
  if (!multTopic.zone_id) throw new Error('Multiplication Tables has no zone_id — check seed-topics.py')

  const algebraTopic = await prisma.topic.findFirst({
    where: { title: 'Algebra: Solving Linear Equations' },
    select: { id: true, zone_id: true, year_group_id: true },
  })
  if (!algebraTopic) throw new Error('Algebra topic not found — run Phase 6 seed first')
  if (!algebraTopic.zone_id) throw new Error('Algebra topic has no zone_id — check seed-phase6.mjs')

  console.log(`  Year 3 topic : Multiplication Tables         (${multTopic.id})`)
  console.log(`  Year 3 zone  : Number Jungle                 (${multTopic.zone_id})`)
  console.log(`  Year 7 topic : Algebra: Solving Linear Eqs   (${algebraTopic.id})`)
  console.log(`  Year 7 zone  : Crystal Labyrinth             (${algebraTopic.zone_id})`)

  // Idempotent clear
  const { count: deleted } = await prisma.worldMapNode.deleteMany({})
  console.log(`\n  Cleared ${deleted} existing world_map_node(s)`)

  // Year 3 node
  await prisma.worldMapNode.create({
    data: {
      zone_id: multTopic.zone_id,
      topic_id: multTopic.id,
      x_pos: 0.5,
      y_pos: 0.5,
      unlocked_by_topic_id: null,
    },
  })
  console.log('  ✅ Number Jungle node created (Multiplication Tables, always available)')

  // Year 7 node
  await prisma.worldMapNode.create({
    data: {
      zone_id: algebraTopic.zone_id,
      topic_id: algebraTopic.id,
      x_pos: 0.5,
      y_pos: 0.5,
      unlocked_by_topic_id: null,
    },
  })
  console.log('  ✅ Crystal Labyrinth node created (Algebra: Solving Linear Equations, always available)')

  const total = await prisma.worldMapNode.count()
  console.log(`\n  Total world_map_nodes: ${total}`)
  console.log('\nPhase 8 seed complete.\n')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e.message)
  process.exit(1)
})
