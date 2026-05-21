/**
 * Phase 8 verification script.
 *
 * Proves:
 *  1.  world_map_nodes: ≥ 1 node for Number Jungle (Year 3 Maths)
 *  2.  world_map_nodes: ≥ 1 node for Crystal Labyrinth (Year 7 Maths)
 *  3.  Year 3 node topic matches Multiplication Tables
 *  4.  Year 7 node topic matches Algebra: Solving Linear Equations
 *  5.  Year 3 first node has unlocked_by_topic_id = null
 *  6.  Year 7 first node has unlocked_by_topic_id = null
 *  7.  Unlock logic: null prerequisite → 'available' (no progress)
 *  8.  Unlock logic: unmet prerequisite → 'locked'
 *  9.  Unlock logic: met prerequisite → 'available'
 * 10.  Route files exist: world-map page, guardian page, guardian submit API
 * 11.  Component files exist: ZoneMap, TopicNode
 * 12.  Dashboard page contains link to /world-map
 * 13.  Guardian questions: ≥ 15 published questions in Number Jungle zone
 * 14.  Guardian questions: ≥ 15 published questions in Crystal Labyrinth zone
 * 15.  Guardian Slayer badge exists with trigger_rule.type = 'guardian_win'
 * 16.  Legendary cards available for Year 3 (own or shared)
 * 17.  Legendary cards available for Year 7 (own or shared)
 * 18.  Phase 7 regression: Multiplication Tables ≥ 15 published questions
 * 19.  Phase 7 regression: Algebra topic ≥ 15 published questions
 * 20.  Phase 7 regression: card_catalog ≥ 30 published cards
 * 21.  Phase 7 regression: 5 badges seeded
 *
 * Run: node --env-file=.env.local scripts/verify-phase8.mjs
 */

import { PrismaClient } from '@prisma/client'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const prisma = new PrismaClient()
let passed = 0
let failed = 0

function ok(label) {
  console.log(`  ✅ ${label}`)
  passed++
}
function fail(label, detail = '') {
  console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`)
  failed++
}
async function check(label, fn) {
  try {
    await fn()
  } catch (e) {
    fail(label, String(e))
  }
}

// Inline unlock logic (mirrors world-map/page.tsx)
function computeNodeState(topicId, unlockedByTopicId, completedSet) {
  if (completedSet.has(topicId)) return 'completed'
  if (unlockedByTopicId === null) return 'available'
  if (completedSet.has(unlockedByTopicId)) return 'available'
  return 'locked'
}

const ROOT = resolve(process.cwd())

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Phase 8 — Verification')
  console.log('══════════════════════════════════════════════\n')

  // ── 1–2. world_map_nodes exist for both zones ─────────────────────────────
  console.log('1–6. world_map_nodes structure')

  const multTopic = await prisma.topic.findFirst({
    where: { title: 'Multiplication Tables' },
    select: { id: true, zone_id: true },
  })
  const algebraTopic = await prisma.topic.findFirst({
    where: { title: 'Algebra: Solving Linear Equations' },
    select: { id: true, zone_id: true },
  })

  let y3Node = null
  let y7Node = null

  await check('Number Jungle has ≥ 1 world_map_node', async () => {
    if (!multTopic?.zone_id) throw new Error('Multiplication Tables topic not found or no zone_id')
    const nodes = await prisma.worldMapNode.findMany({
      where: { zone_id: multTopic.zone_id },
    })
    if (nodes.length === 0) throw new Error('No nodes for Number Jungle')
    y3Node = nodes[0]
    ok(`Number Jungle: ${nodes.length} node(s) ✓`)
  })

  await check('Crystal Labyrinth has ≥ 1 world_map_node', async () => {
    if (!algebraTopic?.zone_id) throw new Error('Algebra topic not found or no zone_id')
    const nodes = await prisma.worldMapNode.findMany({
      where: { zone_id: algebraTopic.zone_id },
    })
    if (nodes.length === 0) throw new Error('No nodes for Crystal Labyrinth')
    y7Node = nodes[0]
    ok(`Crystal Labyrinth: ${nodes.length} node(s) ✓`)
  })

  await check('Year 3 node topic matches Multiplication Tables', async () => {
    if (!y3Node) throw new Error('No Year 3 node (skipped due to earlier failure)')
    if (y3Node.topic_id !== multTopic.id)
      throw new Error(`Expected ${multTopic.id}, got ${y3Node.topic_id}`)
    ok('Year 3 node topic_id matches Multiplication Tables ✓')
  })

  await check('Year 7 node topic matches Algebra: Solving Linear Equations', async () => {
    if (!y7Node) throw new Error('No Year 7 node (skipped due to earlier failure)')
    if (y7Node.topic_id !== algebraTopic.id)
      throw new Error(`Expected ${algebraTopic.id}, got ${y7Node.topic_id}`)
    ok('Year 7 node topic_id matches Algebra ✓')
  })

  await check('Year 3 first node has unlocked_by_topic_id = null', async () => {
    if (!y3Node) throw new Error('No Year 3 node')
    if (y3Node.unlocked_by_topic_id !== null)
      throw new Error(`Expected null, got ${y3Node.unlocked_by_topic_id}`)
    ok('Year 3 node: unlocked_by_topic_id = null ✓')
  })

  await check('Year 7 first node has unlocked_by_topic_id = null', async () => {
    if (!y7Node) throw new Error('No Year 7 node')
    if (y7Node.unlocked_by_topic_id !== null)
      throw new Error(`Expected null, got ${y7Node.unlocked_by_topic_id}`)
    ok('Year 7 node: unlocked_by_topic_id = null ✓')
  })

  // ── 7–9. Unlock logic unit tests ─────────────────────────────────────────
  console.log('\n7–9. Unlock logic (in-process, no DB side effects)')

  const FAKE_TOPIC   = '00000000-0000-0000-0000-000000000001'
  const FAKE_PREREQ  = '00000000-0000-0000-0000-000000000002'

  await check('Null prerequisite → available (new child)', async () => {
    const state = computeNodeState(FAKE_TOPIC, null, new Set())
    if (state !== 'available') throw new Error(`Expected 'available', got '${state}'`)
    ok("null prerequisite → 'available' ✓")
  })

  await check('Unmet prerequisite → locked', async () => {
    const state = computeNodeState(FAKE_TOPIC, FAKE_PREREQ, new Set())
    if (state !== 'locked') throw new Error(`Expected 'locked', got '${state}'`)
    ok("unmet prerequisite → 'locked' ✓")
  })

  await check('Met prerequisite → available', async () => {
    const state = computeNodeState(FAKE_TOPIC, FAKE_PREREQ, new Set([FAKE_PREREQ]))
    if (state !== 'available') throw new Error(`Expected 'available', got '${state}'`)
    ok("met prerequisite → 'available' ✓")
  })

  // ── 10. Route files exist ─────────────────────────────────────────────────
  console.log('\n10. Route + component files')

  const files = [
    ['app/(child)/world-map/page.tsx', 'World Map page'],
    ['app/(child)/guardian/[zoneId]/page.tsx', 'Guardian page'],
    ['app/api/guardian/[zoneId]/submit/route.ts', 'Guardian submit API'],
    ['components/world-map/ZoneMap.tsx', 'ZoneMap component'],
    ['components/world-map/TopicNode.tsx', 'TopicNode component'],
  ]

  for (const [rel, label] of files) {
    await check(`${label} exists`, async () => {
      if (!existsSync(resolve(ROOT, rel))) throw new Error(`${rel} not found`)
      ok(`${label} ✓`)
    })
  }

  // ── 12. Dashboard contains /world-map link ────────────────────────────────
  console.log('\n12. Dashboard World Map link')
  await check('dashboard/child/page.tsx contains href="/world-map"', async () => {
    const src = readFileSync(resolve(ROOT, 'app/dashboard/child/page.tsx'), 'utf8')
    if (!src.includes('/world-map')) throw new Error('/world-map not found in dashboard page')
    ok('Dashboard links to /world-map ✓')
  })

  // ── 13–14. Guardian question counts ─────────────────────────────────────
  console.log('\n13–14. Guardian question pools')

  await check('Number Jungle zone has ≥ 15 published questions', async () => {
    if (!multTopic?.zone_id) throw new Error('Zone not available')
    const topics = await prisma.topic.findMany({
      where: { zone_id: multTopic.zone_id, is_published: true },
      select: { id: true },
    })
    const count = await prisma.quizQuestion.count({
      where: { topic_id: { in: topics.map((t) => t.id) }, status: 'published' },
    })
    if (count < 15) throw new Error(`Only ${count} questions`)
    ok(`Number Jungle guardian pool: ${count} questions ✓`)
  })

  await check('Crystal Labyrinth zone has ≥ 15 published questions', async () => {
    if (!algebraTopic?.zone_id) throw new Error('Zone not available')
    const topics = await prisma.topic.findMany({
      where: { zone_id: algebraTopic.zone_id, is_published: true },
      select: { id: true },
    })
    const count = await prisma.quizQuestion.count({
      where: { topic_id: { in: topics.map((t) => t.id) }, status: 'published' },
    })
    if (count < 15) throw new Error(`Only ${count} questions`)
    ok(`Crystal Labyrinth guardian pool: ${count} questions ✓`)
  })

  // ── 15. Guardian Slayer badge ─────────────────────────────────────────────
  console.log('\n15–17. Badge + Legendary card')

  await check('Guardian Slayer badge has trigger_rule.type = guardian_win', async () => {
    const badges = await prisma.badge.findMany()
    const guardianBadge = badges.find((b) => {
      const rule = b.trigger_rule
      return typeof rule === 'object' && rule !== null && rule.type === 'guardian_win'
    })
    if (!guardianBadge) throw new Error('No badge with trigger_rule.type=guardian_win found')
    ok(`Guardian Slayer badge: "${guardianBadge.name}" ✓`)
  })

  // ── 16–17. Legendary cards ────────────────────────────────────────────────
  for (const [yearGroupId, label] of [
    ['b81752f5-ae00-4b14-a7fe-f4be1eac5453', 'Year 3'],
    ['6f858189-5913-406f-a3c8-4597942aa69d', 'Year 7'],
  ]) {
    await check(`${label} has ≥ 1 published Legendary card (own or shared)`, async () => {
      const n = await prisma.cardCatalog.count({
        where: {
          rarity: 'legendary',
          status: 'published',
          OR: [{ year_group_id: yearGroupId }, { year_group_id: null }],
        },
      })
      if (n === 0) throw new Error(`No Legendary cards for ${label}`)
      ok(`${label} Legendary pool: ${n} card(s) ✓`)
    })
  }

  // ── 18–21. Phase 7 regressions ────────────────────────────────────────────
  console.log('\n18–21. Phase 7 regression checks')

  await check('Multiplication Tables still has ≥ 15 published questions', async () => {
    if (!multTopic) throw new Error('Topic not found')
    const n = await prisma.quizQuestion.count({
      where: { topic_id: multTopic.id, status: 'published' },
    })
    if (n < 15) throw new Error(`Only ${n} questions`)
    ok(`Multiplication Tables: ${n} questions ✓`)
  })

  await check('Algebra topic still has ≥ 15 published questions', async () => {
    if (!algebraTopic) throw new Error('Topic not found')
    const n = await prisma.quizQuestion.count({
      where: { topic_id: algebraTopic.id, status: 'published' },
    })
    if (n < 15) throw new Error(`Only ${n} questions`)
    ok(`Algebra: ${n} questions ✓`)
  })

  await check('card_catalog has ≥ 30 published cards', async () => {
    const n = await prisma.cardCatalog.count({ where: { status: 'published' } })
    if (n < 30) throw new Error(`Only ${n} cards`)
    ok(`card_catalog: ${n} published cards ✓`)
  })

  await check('5 badges seeded', async () => {
    const n = await prisma.badge.count()
    if (n < 5) throw new Error(`Only ${n} badges`)
    ok(`Badges: ${n} ✓`)
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════')
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log('══════════════════════════════════════════════')

  if (failed === 0) {
    console.log('\n  🟢 Phase 8 gate: PASS')
    console.log('  Next: manual play-test')
    console.log('  1. Dashboard → World Map button visible')
    console.log('  2. Year 3 map renders at 375px — Number Jungle node pulsing')
    console.log('  3. Complete Multiplication Tables quiz → node shows completed + Guardian banner')
    console.log('  4. Battle Guardian → Legendary card reveal + Guardian Slayer badge fires')
    console.log('  5. Repeat for Year 7 Crystal Labyrinth')
  } else {
    console.log('\n  🔴 Phase 8 gate: FAIL — fix issues above before advancing.')
  }
  console.log()

  if (failed > 0) process.exit(1)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Verification error:', e.message)
  process.exit(1)
})
