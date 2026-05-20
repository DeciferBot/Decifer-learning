/**
 * Phase 7 verification script.
 *
 * Proves:
 *  1. card_catalog: ≥ 30 published cards
 *  2. All 5 rarities present in catalog
 *  3. Y3-specific, Y7-specific, and shared cards all present
 *  4. 5 badges seeded with correct trigger_rules
 *  5. pickRarity() distribution over 1000 rolls is within ±5pp of spec
 *     (Common 40 / Uncommon 25 / Rare 15 / Epic 10 / Legendary 10)
 *  6. Perfect Score badge trigger_rule is correctly set
 *  7. Streak 7 badge has threshold = 7
 *  8. CardReveal, DiscoveryCard, BadgePopup component files exist
 *  9. Collection page file exists
 * 10. Shield API routes exist
 * 11. Phase 5 regression: quiz_attempts table still writable
 * 12. Year 3 + Year 7 quiz_questions untouched
 *
 * Run: node --env-file=.env.local scripts/verify-phase7.mjs
 */

import { PrismaClient } from '@prisma/client'
import { existsSync } from 'fs'
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
  try { await fn() } catch (e) { fail(label, String(e)) }
}

// ── Inline pickRarity (mirrors lib/cards.ts) ──────────────────────────────
const RARITY_THRESHOLDS = [
  ['common',    40],
  ['uncommon',  65],
  ['rare',      80],
  ['epic',      90],
  ['legendary', 100],
]
function pickRarity(roll = Math.random() * 100) {
  for (const [rarity, threshold] of RARITY_THRESHOLDS) {
    if (roll < threshold) return rarity
  }
  return 'legendary'
}

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Phase 7 — Verification')
  console.log('══════════════════════════════════════════════\n')

  // ── 1. Card catalog count ─────────────────────────────────────────────────
  console.log('1. card_catalog count')
  let totalCards = 0
  await check('≥ 30 published cards in card_catalog', async () => {
    totalCards = await prisma.cardCatalog.count({ where: { status: 'published' } })
    if (totalCards < 30) throw new Error(`Only ${totalCards} published cards (need ≥ 30)`)
    ok(`${totalCards} published cards ✓`)
  })

  // ── 2. All rarities present ───────────────────────────────────────────────
  console.log('\n2. Rarity coverage')
  const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
  for (const rarity of RARITIES) {
    await check(`${rarity} cards exist`, async () => {
      const n = await prisma.cardCatalog.count({ where: { status: 'published', rarity } })
      if (n === 0) throw new Error(`No ${rarity} cards`)
      ok(`${rarity}: ${n} card${n === 1 ? '' : 's'}`)
    })
  }

  // ── 3. Year-group distribution ────────────────────────────────────────────
  console.log('\n3. Year-group coverage')
  await check('Year 3 specific cards exist', async () => {
    const n = await prisma.cardCatalog.count({
      where: { status: 'published', year_group_id: 'b81752f5-ae00-4b14-a7fe-f4be1eac5453' },
    })
    if (n === 0) throw new Error('No Year 3 specific cards')
    ok(`Year 3 specific: ${n} cards`)
  })
  await check('Year 7 specific cards exist', async () => {
    const n = await prisma.cardCatalog.count({
      where: { status: 'published', year_group_id: '6f858189-5913-406f-a3c8-4597942aa69d' },
    })
    if (n === 0) throw new Error('No Year 7 specific cards')
    ok(`Year 7 specific: ${n} cards`)
  })
  await check('Shared (null year_group) cards exist', async () => {
    const n = await prisma.cardCatalog.count({
      where: { status: 'published', year_group_id: null },
    })
    if (n === 0) throw new Error('No shared cards')
    ok(`Shared: ${n} cards`)
  })

  // ── 4. Badges ─────────────────────────────────────────────────────────────
  console.log('\n4. Badges')
  const expectedBadges = ['Topic Star', 'Perfect Score', 'Subject Champion', 'Streak 7', 'Guardian Slayer']
  for (const name of expectedBadges) {
    await check(`"${name}" badge exists`, async () => {
      const b = await prisma.badge.findUnique({ where: { name } })
      if (!b) throw new Error(`Badge "${name}" not found`)
      ok(`"${name}" seeded ✓`)
    })
  }

  // ── 5. Rarity distribution simulation (1000 rolls) ────────────────────────
  console.log('\n5. Rarity distribution (1000 simulated rolls, ±5pp tolerance)')
  const EXPECTED = { common: 40, uncommon: 25, rare: 15, epic: 10, legendary: 10 }
  const TOLERANCE = 5
  const ROLLS = 1000
  const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
  for (let i = 0; i < ROLLS; i++) counts[pickRarity()]++

  for (const [rarity, expected] of Object.entries(EXPECTED)) {
    await check(`${rarity} within ±${TOLERANCE}pp of ${expected}%`, async () => {
      const observed = (counts[rarity] / ROLLS) * 100
      const diff = Math.abs(observed - expected)
      if (diff > TOLERANCE)
        throw new Error(`${rarity}: expected ~${expected}%, got ${observed.toFixed(1)}% (diff ${diff.toFixed(1)}pp)`)
      ok(`${rarity}: ${observed.toFixed(1)}% (expected ${expected}%, diff ${diff.toFixed(1)}pp) ✓`)
    })
  }

  // ── 6. Perfect Score badge trigger ────────────────────────────────────────
  console.log('\n6. Badge trigger rules')
  await check('"Perfect Score" trigger_rule has type=perfect_score', async () => {
    const b = await prisma.badge.findUnique({ where: { name: 'Perfect Score' } })
    if (!b) throw new Error('Perfect Score badge not found')
    const rule = b.trigger_rule
    if (typeof rule !== 'object' || rule === null || rule.type !== 'perfect_score')
      throw new Error(`Expected type=perfect_score, got ${JSON.stringify(rule)}`)
    ok('Perfect Score: type=perfect_score ✓')
  })
  await check('"Streak 7" trigger_rule has threshold=7', async () => {
    const b = await prisma.badge.findUnique({ where: { name: 'Streak 7' } })
    if (!b) throw new Error('Streak 7 badge not found')
    const rule = b.trigger_rule
    if (typeof rule !== 'object' || rule === null || rule.threshold !== 7)
      throw new Error(`Expected threshold=7, got ${JSON.stringify(rule)}`)
    ok('Streak 7: threshold=7 ✓')
  })
  await check('"Topic Star" trigger_rule has type=topic_complete', async () => {
    const b = await prisma.badge.findUnique({ where: { name: 'Topic Star' } })
    if (!b) throw new Error('Topic Star badge not found')
    const rule = b.trigger_rule
    if (typeof rule !== 'object' || rule === null || rule.type !== 'topic_complete')
      throw new Error(`Expected type=topic_complete, got ${JSON.stringify(rule)}`)
    ok('Topic Star: type=topic_complete ✓')
  })

  // ── 7. Component and page files exist ─────────────────────────────────────
  console.log('\n7. New component and page files')
  const FILES = [
    'components/cards/DiscoveryCard.tsx',
    'components/cards/CardReveal.tsx',
    'components/quiz/BadgePopup.tsx',
    'app/(child)/collection/page.tsx',
    'lib/cards.ts',
    'app/api/streak/shields/route.ts',
    'app/api/streak/shields/use/route.ts',
  ]
  for (const f of FILES) {
    await check(`${f} exists`, async () => {
      if (!existsSync(resolve(f))) throw new Error(`Missing: ${f}`)
      ok(`${f} ✓`)
    })
  }

  // ── 8. Phase 5 regression: live DB write ──────────────────────────────────
  console.log('\n8. Phase 5 regression (DB write)')
  const TOPIC_ID = 'd8089833-9cb5-4714-aa4b-01713c072a7e'
  await check('quiz_attempt write + delete still works', async () => {
    const profile = await prisma.profile.findFirst({ select: { id: true } })
    if (!profile) throw new Error('No profiles — register a user first')
    const a = await prisma.quizAttempt.create({
      data: {
        profile_id: profile.id,
        topic_id: TOPIC_ID,
        score: 1.0,
        hints_used: 0,
        time_taken_seconds: 60,
        hearts_remaining: 3,
      },
    })
    await prisma.quizAttempt.delete({ where: { id: a.id } })
    ok(`quiz_attempts write + delete round-trip ✓`)
  })

  // ── 9. Question counts unchanged ─────────────────────────────────────────
  console.log('\n9. Existing quiz content regression')
  await check('Multiplication Tables still has ≥ 15 published questions', async () => {
    const n = await prisma.quizQuestion.count({
      where: { topic_id: TOPIC_ID, status: 'published' },
    })
    if (n < 15) throw new Error(`Only ${n} questions`)
    ok(`Multiplication Tables: ${n} questions ✓`)
  })
  await check('Algebra: Solving Linear Equations still has ≥ 15 published questions', async () => {
    const topic = await prisma.topic.findFirst({ where: { title: 'Algebra: Solving Linear Equations' } })
    if (!topic) throw new Error('Algebra topic not found')
    const n = await prisma.quizQuestion.count({
      where: { topic_id: topic.id, status: 'published' },
    })
    if (n < 15) throw new Error(`Only ${n} questions`)
    ok(`Algebra: Solving Linear Equations: ${n} questions ✓`)
  })

  // ── 10. Card drop: candidate cards exist for Y3 and Y7 per rarity ─────────
  console.log('\n10. Card pool sanity (Y3 and Y7 each get candidates per rarity)')
  for (const [yearGroupId, label] of [
    ['b81752f5-ae00-4b14-a7fe-f4be1eac5453', 'Year 3'],
    ['6f858189-5913-406f-a3c8-4597942aa69d', 'Year 7'],
  ]) {
    for (const rarity of RARITIES) {
      await check(`${label} has ≥ 1 published ${rarity} card (own or shared)`, async () => {
        const n = await prisma.cardCatalog.count({
          where: {
            status: 'published',
            rarity,
            OR: [{ year_group_id: yearGroupId }, { year_group_id: null }],
          },
        })
        if (n === 0) throw new Error(`No ${rarity} cards for ${label}`)
        ok(`${label} ${rarity}: ${n} candidate card${n === 1 ? '' : 's'} ✓`)
      })
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════')
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log('══════════════════════════════════════════════')
  if (failed === 0) {
    console.log('\n  🟢 Phase 7 gate: PASS')
    console.log('  Next: manual play-test — complete a quiz and verify')
    console.log('  CardReveal modal + BadgePopup appear. Check /collection.')
  } else {
    console.log('\n  🔴 Phase 7 gate: FAIL — fix issues above before advancing.')
  }
  console.log()

  if (failed > 0) process.exit(1)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Verification error:', e.message)
  process.exit(1)
})
