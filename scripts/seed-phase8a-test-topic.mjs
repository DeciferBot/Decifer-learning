/**
 * Phase 8A — Test topic shell.
 *
 * Creates a single Year 3 Maths topic ("Addition and Subtraction") that
 * the pipeline will fill via /api/pipeline/generate. This is METADATA
 * ONLY — no learn_content / practice_games / quiz_questions are inserted
 * here. The whole point of Phase 8A is to prove the pipeline path works
 * end-to-end without going back to hand-seeded content.
 *
 * Also seeds ONE curriculum_outcome row mapped to the new topic, so the
 * resulting questions can be measured against a real NC outcome.
 *
 * Idempotent: safe to re-run.
 *
 * Run:
 *   node --env-file=.env.local scripts/seed-phase8a-test-topic.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPIC_TITLE = 'Addition and Subtraction'
const TOPIC_SLUG = 'addition-and-subtraction'

// NC 2014 KS2 Y3 Number — Addition and Subtraction. Statutory outcome verbatim
// (DFE-00178-2013 p.23). Source-of-truth taxonomy lives in CURRICULUM_COVERAGE_REPORT.md.
const OUTCOME = {
  framework_country: 'England',
  framework_name: 'National Curriculum 2014',
  key_stage: 'KS2',
  year_group: 'Year 3',
  subject: 'Mathematics',
  domain: 'Number – addition and subtraction',
  statutory_outcome:
    'Add and subtract numbers mentally, including: a three-digit number and ones; a three-digit number and tens; a three-digit number and hundreds.',
  source_reference: 'NC 2014 Maths KS2 Y3 AS-001 | DFE-00178-2013 p.23',
  app_skill_id: 'mental_addition_subtraction_3digit',
  required_content_types: [
    'quiz_sprout',
    'quiz_explorer',
    'quiz_lightning',
  ],
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  Phase 8A — Test topic shell')
  console.log('  Topic: Year 3 / Maths / Addition and Subtraction (NOT published)')
  console.log('══════════════════════════════════════════════════════════════════\n')

  const yearGroup = await prisma.yearGroup.findFirst({
    where: { label: 'year-3' },
  })
  if (!yearGroup) throw new Error('year-3 not found — re-run Phase 2 seed first')

  const subject = await prisma.subject.findFirst({ where: { name: 'Maths' } })
  if (!subject) throw new Error('Maths subject not found — re-run Phase 2 seed first')

  const zone = await prisma.zone.findFirst({
    where: {
      year_group_id: yearGroup.id,
      subject_id: subject.id,
      name: 'Number Jungle',
    },
  })
  if (!zone) throw new Error('Number Jungle zone not found — re-run Phase 2 seed first')

  // Topic shell. is_published=false so it cannot be reached by children
  // until an admin flips it on after spot-check.
  const existing = await prisma.topic.findFirst({
    where: { subject_id: subject.id, slug: TOPIC_SLUG },
  })

  let topic
  if (existing) {
    topic = existing
    console.log(`  topic already exists: ${topic.id}`)
  } else {
    const maxOrder = await prisma.topic.aggregate({
      _max: { order_index: true },
      where: { year_group_id: yearGroup.id, subject_id: subject.id },
    })
    topic = await prisma.topic.create({
      data: {
        subject_id: subject.id,
        year_group_id: yearGroup.id,
        zone_id: zone.id,
        title: TOPIC_TITLE,
        slug: TOPIC_SLUG,
        order_index: (maxOrder._max.order_index ?? 0) + 1,
        is_published: false,
      },
    })
    console.log(`  topic created: ${topic.id}`)
  }

  // Curriculum-outcome mapping.
  const outcomeExisting = await prisma.curriculumOutcome.findFirst({
    where: { source_reference: OUTCOME.source_reference },
  })

  let outcome
  if (outcomeExisting) {
    outcome = await prisma.curriculumOutcome.update({
      where: { id: outcomeExisting.id },
      data: {
        app_subject_id: subject.id,
        app_topic_id: topic.id,
        app_skill_id: OUTCOME.app_skill_id,
        coverage_status: 'mapped',
      },
    })
    console.log(`  curriculum_outcome already existed, re-mapped: ${outcome.id}`)
  } else {
    outcome = await prisma.curriculumOutcome.create({
      data: {
        ...OUTCOME,
        app_subject_id: subject.id,
        app_topic_id: topic.id,
        required_content_types: OUTCOME.required_content_types,
        coverage_status: 'mapped',
        verification_status: 'unverified',
      },
    })
    console.log(`  curriculum_outcome created: ${outcome.id}`)
  }

  // Summary — these IDs are what the admin trigger / proof script need.
  console.log('\n  Phase 8A test topic ready:')
  console.log(`    topic_id   = ${topic.id}`)
  console.log(`    outcome_id = ${outcome.id}`)
  console.log(`    is_published = ${topic.is_published}`)
  console.log('\n  Next steps:')
  console.log('    1. Set PHASE_8A_TEST_TOPIC_ID env var to the topic_id above.')
  console.log('    2. Trigger generation via /dashboard/admin/pipeline or:')
  console.log(
    '       curl -X POST $APP/api/pipeline/generate \\',
  )
  console.log(
    `         -H "x-admin-token: $ADMIN_PIPELINE_TOKEN" \\`,
  )
  console.log(
    `         -H "content-type: application/json" \\`,
  )
  console.log(
    `         -d '{"topic_id":"${topic.id}","tier":"sprout","count":3}'`,
  )
  console.log(
    '    3. Run scripts/verify-phase8a.mjs to confirm the activation gate.\n',
  )
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
