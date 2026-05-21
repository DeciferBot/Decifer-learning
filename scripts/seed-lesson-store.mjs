/**
 * Lesson Store — Seed Script
 *
 * Creates the first published lesson records for the Multiplication Tables topic
 * (Year 3, KS2, Maths). Proves the end-to-end Lesson Store vertical slice.
 *
 * Prerequisites:
 *   - seed-phase4.mjs must have run (learn_content published)
 *   - seed-phase4.1-quiz.mjs must have run (quiz questions published)
 *   - seed-curriculum-england-primary-maths-multiplication.mjs must have run
 *
 * What this script does:
 *   1. Sets subject.slug = 'maths' for the Maths subject
 *   2. Sets topic.slug = 'multiplication-tables' for the Multiplication Tables topic
 *   3. Creates one lesson record per difficulty lane that has published quiz questions
 *      (sprout, explorer, lightning — only created if the tier's questions exist)
 *   4. Each lesson: status='published', verification_status='verified'
 *   5. Each lesson linked to the appropriate curriculum outcome
 *
 * Idempotent: safe to re-run.
 *
 * Run: node --env-file=.env.local scripts/seed-lesson-store.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MATHS_SUBJECT_ID     = '1f769381-bd81-40c2-a84c-bb5c777a89ad'
const MULTIPLICATION_TOPIC = 'd8089833-9cb5-4714-aa4b-01713c072a7e'

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  Lesson Store — Seed')
  console.log('  Scope: Maths / Multiplication Tables / Year 3 / KS2')
  console.log('══════════════════════════════════════════════════════════════════\n')

  // ── 1. Verify prerequisites ───────────────────────────────────────────────
  const subject = await prisma.subject.findUnique({ where: { id: MATHS_SUBJECT_ID } })
  if (!subject) {
    console.error('❌ Maths subject not found. Run seed-topics.py first.')
    process.exit(1)
  }
  const topic = await prisma.topic.findUnique({ where: { id: MULTIPLICATION_TOPIC } })
  if (!topic) {
    console.error('❌ Multiplication Tables topic not found. Run seed-phase4.mjs first.')
    process.exit(1)
  }
  console.log(`✅ Subject: "${subject.name}"`)
  console.log(`✅ Topic:   "${topic.title}"`)

  const learnContent = await prisma.learnContent.findFirst({
    where: { topic_id: MULTIPLICATION_TOPIC, status: 'published' },
  })
  if (!learnContent) {
    console.error('❌ No published learn_content for this topic. Run seed-phase4.mjs first.')
    process.exit(1)
  }
  console.log('✅ Published learn_content found')

  // ── 2. Set slugs on subject and topic ─────────────────────────────────────
  await prisma.subject.update({
    where: { id: MATHS_SUBJECT_ID },
    data: { slug: 'maths' },
  })
  console.log('\n✅ subjects.slug = "maths"')

  await prisma.topic.update({
    where: { id: MULTIPLICATION_TOPIC },
    data: { slug: 'multiplication-tables' },
  })
  console.log('✅ topics.slug = "multiplication-tables"')

  // ── 3. Look up the mapped curriculum outcomes ─────────────────────────────
  const outcomes = await prisma.curriculumOutcome.findMany({
    where: { app_topic_id: MULTIPLICATION_TOPIC, coverage_status: 'mapped' },
    orderBy: { source_reference: 'asc' },
  })
  console.log(`\n✅ Found ${outcomes.length} mapped curriculum outcomes`)
  for (const o of outcomes) {
    console.log(`     ${o.source_reference.split('|')[0].trim()}`)
  }

  // ── 4. Check which quiz tiers have published questions ────────────────────
  const tiersWithContent = []
  for (const tier of ['sprout', 'explorer', 'lightning']) {
    const count = await prisma.quizQuestion.count({
      where: { topic_id: MULTIPLICATION_TOPIC, tier, status: 'published' },
    })
    if (count > 0) {
      tiersWithContent.push(tier)
      console.log(`✅ Quiz tier ${tier}: ${count} published questions`)
    } else {
      console.log(`⚠️  Quiz tier ${tier}: 0 published questions — skipping lesson`)
    }
  }

  // ── 5. Lane → curriculum outcome mapping ──────────────────────────────────
  // Map each difficulty lane to the curriculum outcome most closely aligned:
  //   sprout    → Y3 MD-001 (recall facts — the entry-level skill)
  //   explorer  → Y3 MD-002 (write and calculate — applying knowledge)
  //   lightning → Y3 MD-003 (problem solving — highest demand)
  const outcomeByLane = {
    sprout:    outcomes.find(o => o.source_reference.includes('Y3 MD-001')) ?? outcomes[0],
    explorer:  outcomes.find(o => o.source_reference.includes('Y3 MD-002')) ?? outcomes[1],
    lightning: outcomes.find(o => o.source_reference.includes('Y3 MD-003')) ?? outcomes[2],
  }

  const LESSON_TEMPLATES = [
    {
      lane: 'sprout',
      slug: 'y3-multiplication-tables-sprout',
      title: 'Multiplication Tables — Sprout',
      lesson_summary:
        'Recall and use the 3, 4 and 8 multiplication tables. Build confidence with times-table facts through practice and games.',
      learning_objective:
        'I can recall multiplication and division facts for the 3, 4 and 8 times tables.',
      estimated_minutes: 15,
      lesson_type: 'core_lesson',
      app_experience: 'learn,practise,quiz_sprout',
      source_reference: 'NC 2014 Maths KS2 Y3 MD-001 | DFE-00178-2013 p.24',
      verification_method: 'curriculum_outcome_mapping',
    },
    {
      lane: 'explorer',
      slug: 'y3-multiplication-tables-explorer',
      title: 'Multiplication Tables — Explorer',
      lesson_summary:
        'Write and calculate multiplication and division statements, including two-digit numbers times one-digit numbers.',
      learning_objective:
        'I can write and calculate multiplication and division statements using known tables, including 2-digit × 1-digit numbers.',
      estimated_minutes: 20,
      lesson_type: 'core_lesson',
      app_experience: 'learn,practise,quiz_explorer',
      source_reference: 'NC 2014 Maths KS2 Y3 MD-002 | DFE-00178-2013 p.24',
      verification_method: 'curriculum_outcome_mapping',
    },
    {
      lane: 'lightning',
      slug: 'y3-multiplication-tables-lightning',
      title: 'Multiplication Tables — Lightning',
      lesson_summary:
        'Solve problems involving multiplication and division, including missing number problems and scaling problems.',
      learning_objective:
        'I can solve multiplication and division problems, including missing number problems and correspondence problems.',
      estimated_minutes: 25,
      lesson_type: 'core_lesson',
      app_experience: 'learn,practise,quiz_lightning',
      source_reference: 'NC 2014 Maths KS2 Y3 MD-003 | DFE-00178-2013 p.24',
      verification_method: 'curriculum_outcome_mapping',
    },
  ]

  // ── 6. Upsert lesson records (only for tiers with published questions) ─────
  console.log('\n── Creating / updating lesson records ───────────────────────────')
  let created = 0
  let updated = 0

  for (const tpl of LESSON_TEMPLATES) {
    if (!tiersWithContent.includes(tpl.lane)) continue

    const outcome = outcomeByLane[tpl.lane]

    const existing = await prisma.lesson.findFirst({ where: { slug: tpl.slug } })
    const data = {
      subject_id:            MATHS_SUBJECT_ID,
      topic_id:              MULTIPLICATION_TOPIC,
      curriculum_outcome_id: outcome?.id ?? null,
      title:                 tpl.title,
      lesson_summary:        tpl.lesson_summary,
      learning_objective:    tpl.learning_objective,
      key_stage:             'KS2',
      year_group:            'Year 3',
      difficulty_lane:       tpl.lane,
      lesson_type:           tpl.lesson_type,
      estimated_minutes:     tpl.estimated_minutes,
      app_experience:        tpl.app_experience,
      status:                'published',
      verification_method:   tpl.verification_method,
      verification_status:   'verified',
      source_reference:      tpl.source_reference,
    }

    if (existing) {
      await prisma.lesson.update({ where: { id: existing.id }, data })
      console.log(`  ↻ Updated: "${tpl.slug}"`)
      updated++
    } else {
      await prisma.lesson.create({ data: { slug: tpl.slug, ...data } })
      console.log(`  ✅ Created: "${tpl.slug}"`)
      created++
    }
  }

  // ── 7. Summary ───────────────────────────────────────────────────────────
  const total = await prisma.lesson.count({
    where: {
      topic_id: MULTIPLICATION_TOPIC,
      status: 'published',
      verification_status: 'verified',
    },
  })

  console.log(`\n══════════════════════════════════════════════════════════════════`)
  console.log(`  Done: ${created} created, ${updated} updated`)
  console.log(`  Published+verified lessons for this topic: ${total}`)
  console.log()
  console.log('  Vertical slice route:')
  console.log('    /learn/maths/multiplication-tables/y3-multiplication-tables-sprout')
  console.log()
  console.log('  Run verify-lesson-store-safety.mjs to confirm safety gates.')
  console.log('══════════════════════════════════════════════════════════════════\n')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed error:', e.message)
  process.exit(1)
})
