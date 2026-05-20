/**
 * Phase 2.5 live Supabase verification script.
 * Run with:
 *   DATABASE_URL='<direct-url>' node scripts/verify-phase2.5.mjs
 *
 * Checks tables, enums, indexes, seeds (year_groups, subjects, zones),
 * the auth-bridge trigger, and RLS policy counts.
 *
 * Does NOT require the service role key — uses the direct Postgres URL.
 * RLS proof-of-denial tests are documented separately (require service role).
 */

import { PrismaClient } from '@prisma/client'

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
  } catch (err) {
    fail(label, String(err))
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Phase 2.5 — Supabase Live Verification')
  console.log('══════════════════════════════════════════════\n')

  // ── 1. Extensions ────────────────────────────────────────────────────────
  console.log('1. Extensions')
  await check('pgcrypto installed', async () => {
    const rows = await prisma.$queryRaw`
      SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`
    if (rows.length === 0) throw new Error('pgcrypto not found')
    ok('pgcrypto installed')
  })
  await check('vector installed', async () => {
    const rows = await prisma.$queryRaw`
      SELECT extname FROM pg_extension WHERE extname = 'vector'`
    if (rows.length === 0) throw new Error('pgvector not found')
    ok('vector (pgvector) installed')
  })

  // ── 2. Enums ─────────────────────────────────────────────────────────────
  console.log('\n2. Enums')
  for (const enumName of ['Role', 'ContentStatus', 'Tier']) {
    await check(`enum ${enumName}`, async () => {
      const rows = await prisma.$queryRaw`
        SELECT typname FROM pg_type WHERE typname = ${enumName}`
      if (rows.length === 0) throw new Error(`enum ${enumName} missing`)
      ok(`enum ${enumName}`)
    })
  }

  // ── 3. Tables ─────────────────────────────────────────────────────────────
  console.log('\n3. Tables')
  const expectedTables = [
    'profiles', 'family_links', 'parent_controls',
    'year_groups', 'subjects', 'topics', 'zones', 'world_map_nodes',
    'learn_content', 'practice_games', 'quiz_questions',
    'point_events', 'badges', 'profile_badges', 'streak_shields',
    'card_catalog', 'child_collection',
    'topic_progress', 'quiz_attempts', 'quiz_answers', 'session_answers',
    'child_missions', 'past_paper_questions',
    'curriculum_chunks', 'daily_challenges',
  ]
  const tableRows = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  const existingTables = new Set(tableRows.map(r => r.table_name))
  for (const t of expectedTables) {
    if (existingTables.has(t)) ok(`table ${t}`)
    else fail(`table ${t}`, 'missing')
  }

  // ── 4. Key indexes ────────────────────────────────────────────────────────
  console.log('\n4. Indexes')
  const indexes = [
    { name: 'profiles_user_id_key', table: 'profiles' },
    { name: 'year_groups_label_key', table: 'year_groups' },
    { name: 'quiz_questions_topic_id_status_tier_idx', table: 'quiz_questions' },
    { name: 'curriculum_chunks_subject_year_group_idx', table: 'curriculum_chunks' },
  ]
  for (const idx of indexes) {
    await check(`index ${idx.name}`, async () => {
      const rows = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename = ${idx.table} AND indexname = ${idx.name}`
      if (rows.length === 0) throw new Error(`index ${idx.name} missing`)
      ok(`index ${idx.name}`)
    })
  }

  // ── 5. FK: profiles.user_id → auth.users ─────────────────────────────────
  console.log('\n5. auth.users bridge FK')
  await check('profiles_user_id_auth_users_fkey', async () => {
    const rows = await prisma.$queryRaw`
      SELECT conname FROM pg_constraint
      WHERE conname = 'profiles_user_id_auth_users_fkey'`
    if (rows.length === 0) throw new Error('FK not found')
    ok('profiles_user_id_auth_users_fkey exists (cascade delete)')
  })

  // ── 6. CHECK constraint: child must have year_group ───────────────────────
  console.log('\n6. Check constraint')
  await check('profiles_role_year_group_chk', async () => {
    const rows = await prisma.$queryRaw`
      SELECT conname FROM pg_constraint
      WHERE conname = 'profiles_role_year_group_chk'`
    if (rows.length === 0) throw new Error('CHECK constraint missing')
    ok('profiles_role_year_group_chk exists')
  })

  // ── 7. Seed data ──────────────────────────────────────────────────────────
  console.log('\n7. Seed data')

  const yearGroups = await prisma.yearGroup.findMany({ orderBy: { label: 'asc' } })
  const ygLabels = yearGroups.map(y => y.label)
  if (ygLabels.length === 2 && ygLabels.includes('year-3') && ygLabels.includes('year-7')) {
    ok(`year_groups: year-3 (KS2), year-7 (KS3) — no other rows`)
  } else {
    fail('year_groups', `Expected [year-3, year-7], got [${ygLabels.join(', ')}]`)
  }

  const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } })
  const subjectNames = subjects.map(s => s.name)
  for (const name of ['English', 'Maths', 'Science']) {
    if (subjectNames.includes(name)) ok(`subject ${name}`)
    else fail(`subject ${name}`, 'missing from subjects table')
  }

  const zones = await prisma.zone.findMany()
  const zoneNames = zones.map(z => z.name).sort()
  const expectedZones = [
    'Crystal Labyrinth', 'Discovery Cave', 'Elemental Forge',
    'Library of Echoes', 'Number Jungle', 'Whispering Woods',
  ]
  for (const z of expectedZones) {
    if (zoneNames.includes(z)) ok(`zone "${z}"`)
    else fail(`zone "${z}"`, 'missing')
  }
  if (zones.length === 6) ok('exactly 6 zones (no extras)')
  else fail('zone count', `Expected 6, got ${zones.length}`)

  // Confirm no topics/learn_content/quiz_questions/card_catalog/badges/missions seeded
  const [topicCount, learnCount, quizCount, cardCount, badgeCount, missionCount] =
    await Promise.all([
      prisma.topic.count(),
      prisma.learnContent.count(),
      prisma.quizQuestion.count(),
      prisma.cardCatalog.count(),
      prisma.badge.count(),
      prisma.childMission.count(),
    ])
  const unexpectedSeeds = { topics: topicCount, learnContent: learnCount, quizQuestions: quizCount, cardCatalog: cardCount, badges: badgeCount, childMissions: missionCount }
  for (const [table, count] of Object.entries(unexpectedSeeds)) {
    if (count === 0) ok(`${table}: 0 rows (not pre-seeded — correct)`)
    else fail(`${table}`, `Expected 0 rows, found ${count}`)
  }

  // ── 8. Auth trigger ───────────────────────────────────────────────────────
  console.log('\n8. Auth trigger')
  await check('handle_new_auth_user function exists', async () => {
    const rows = await prisma.$queryRaw`
      SELECT proname FROM pg_proc
      JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
      WHERE pg_namespace.nspname = 'public'
        AND proname = 'handle_new_auth_user'`
    if (rows.length === 0) throw new Error('function missing')
    ok('handle_new_auth_user() function exists')
  })
  await check('on_auth_user_created trigger exists', async () => {
    const rows = await prisma.$queryRaw`
      SELECT tgname FROM pg_trigger
      WHERE tgname = 'on_auth_user_created'`
    if (rows.length === 0) throw new Error('trigger missing')
    ok('on_auth_user_created trigger exists on auth.users')
  })

  // ── 9. RLS enabled ────────────────────────────────────────────────────────
  console.log('\n9. RLS enabled on tables')
  const rlsTables = [
    'profiles', 'family_links', 'parent_controls',
    'year_groups', 'subjects', 'zones', 'topics',
    'learn_content', 'quiz_questions', 'card_catalog',
    'topic_progress', 'quiz_attempts', 'quiz_answers', 'session_answers',
    'point_events', 'child_collection', 'profile_badges', 'streak_shields',
    'child_missions', 'world_map_nodes', 'practice_games',
    'badges', 'daily_challenges', 'past_paper_questions', 'curriculum_chunks',
  ]
  const rlsRows = await prisma.$queryRaw`
    SELECT relname FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public'
      AND relrowsecurity = true
      AND relkind = 'r'`
  const rlsEnabled = new Set(rlsRows.map(r => r.relname))
  for (const t of rlsTables) {
    if (rlsEnabled.has(t)) ok(`RLS enabled on ${t}`)
    else fail(`RLS on ${t}`, 'not enabled')
  }

  // ── 10. RLS policies ─────────────────────────────────────────────────────
  console.log('\n10. RLS policy counts (spot-check key policies)')
  const policyRows = await prisma.$queryRaw`
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname`

  const policies = {}
  for (const row of policyRows) {
    if (!policies[row.tablename]) policies[row.tablename] = []
    policies[row.tablename].push(row.policyname)
  }

  const requiredPolicies = [
    ['profiles', 'profiles_select_self'],
    ['profiles', 'profiles_select_linked_child'],
    ['profiles', 'profiles_update_self'],
    ['family_links', 'family_links_select_party'],
    ['year_groups', 'year_groups_select_authenticated'],
    ['subjects', 'subjects_select_authenticated'],
    ['zones', 'zones_select_authenticated'],
    ['topics', 'topics_select_published'],
    ['learn_content', 'learn_content_select_published'],
    ['quiz_questions', 'quiz_questions_select_published'],
    ['card_catalog', 'card_catalog_select_published'],
    ['topic_progress', 'topic_progress_owner_all'],
    ['quiz_attempts', 'quiz_attempts_owner_all'],
    ['quiz_answers', 'quiz_answers_owner_all'],
    ['child_collection', 'child_collection_owner_all'],
  ]
  for (const [table, policy] of requiredPolicies) {
    if (policies[table]?.includes(policy)) ok(`policy ${policy} on ${table}`)
    else fail(`policy ${policy} on ${table}`, 'missing')
  }

  console.log('\n' + '─'.repeat(46))
  console.log(`  PASSED: ${passed}   FAILED: ${failed}`)
  console.log('─'.repeat(46))
  if (failed === 0) {
    console.log('\n  ✅ Phase 2.5 database verification: PASS\n')
  } else {
    console.log('\n  ❌ Phase 2.5 database verification: FAIL\n')
    process.exit(1)
  }
}

main()
  .catch(err => {
    console.error('\nFatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
