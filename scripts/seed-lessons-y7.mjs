/**
 * Lesson Store — Year 7 bulk seed
 *
 * Creates published+verified lesson records for every published Y7 topic
 * that has at least one published quiz question. One lesson per difficulty
 * lane (sprout / explorer / lightning) where questions exist.
 *
 * Also sets missing slugs on subjects and topics.
 *
 * Idempotent: safe to re-run.
 *
 * Run: node --env-file=.env.local scripts/seed-lessons-y7.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Slugify a topic title: "Algebra: Solving Linear Equations" → "algebra-solving-linear-equations"
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Lane → display label
const LANE_LABEL = { sprout: 'Sprout', explorer: 'Explorer', lightning: 'Lightning' }

// Lane → app experience string
const LANE_EXPERIENCE = {
  sprout:    'learn,practise,quiz_sprout',
  explorer:  'learn,practise,quiz_explorer',
  lightning: 'learn,practise,quiz_lightning',
}

// Estimated minutes per lane
const LANE_MINUTES = { sprout: 15, explorer: 20, lightning: 25 }

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  Lesson Store — Year 7 bulk seed')
  console.log('══════════════════════════════════════════════════════════════════\n')

  // ── 1. Set subject slugs ───────────────────────────────────────────────────
  const SUBJECT_SLUGS = { Maths: 'maths', English: 'english', Science: 'science' }
  for (const [name, slug] of Object.entries(SUBJECT_SLUGS)) {
    await prisma.subject.updateMany({ where: { name }, data: { slug } })
    console.log(`✅ subjects.slug = "${slug}" for ${name}`)
  }

  // ── 2. Load all published Y7 topics ───────────────────────────────────────
  const topics = await prisma.topic.findMany({
    where: { year_group: { label: 'year-7' }, is_published: true },
    include: { subject: true },
    orderBy: [{ subject: { name: 'asc' } }, { order_index: 'asc' }],
  })
  console.log(`\n✅ Found ${topics.length} published Year 7 topics\n`)

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0

  // ── 3. Process each topic ─────────────────────────────────────────────────
  for (const topic of topics) {
    // Ensure topic has a slug
    if (!topic.slug) {
      const newSlug = 'y7-' + slugify(topic.title).replace(/^y7-/, '')
      await prisma.topic.update({ where: { id: topic.id }, data: { slug: newSlug } })
      topic.slug = newSlug
      console.log(`  ↺ Set topic slug: "${newSlug}"`)
    }

    const subjectSlug = topic.subject.slug
    const topicSlug   = topic.slug

    // Check published questions per tier
    const tierCounts = {}
    for (const tier of ['sprout', 'explorer', 'lightning']) {
      tierCounts[tier] = await prisma.quizQuestion.count({
        where: { topic_id: topic.id, tier, status: 'published' },
      })
    }

    const activeTiers = Object.entries(tierCounts)
      .filter(([, count]) => count > 0)
      .map(([tier]) => tier)

    if (activeTiers.length === 0) {
      console.log(`  ⚠️  ${topic.subject.name} / ${topic.title} — no published questions, skipping`)
      totalSkipped++
      continue
    }

    // Find mapped curriculum outcomes
    const outcomes = await prisma.curriculumOutcome.findMany({
      where: { app_topic_id: topic.id, coverage_status: 'mapped' },
      orderBy: { source_reference: 'asc' },
    })

    // Assign outcomes to lanes in order; fall back to first if fewer than 3
    const outcomeForLane = (laneIdx) => outcomes[Math.min(laneIdx, outcomes.length - 1)] ?? null

    let topicCreated = 0
    let topicUpdated = 0

    for (const [laneIdx, lane] of ['sprout', 'explorer', 'lightning'].entries()) {
      if (!activeTiers.includes(lane)) continue

      const outcome   = outcomeForLane(laneIdx)
      const laneLabel = LANE_LABEL[lane]
      const slug      = `y7-${topicSlug.replace(/^y7-/, '')}-${lane}`
      const title     = `${topic.title} — ${laneLabel}`

      const data = {
        subject_id:            topic.subject_id,
        topic_id:              topic.id,
        curriculum_outcome_id: outcome?.id ?? null,
        title,
        lesson_summary:        `${topic.title} at ${laneLabel} level. Part of the Year 7 ${topic.subject.name} curriculum.`,
        learning_objective:    `I can work with ${topic.title.toLowerCase()} at the ${laneLabel.toLowerCase()} level.`,
        key_stage:             'KS3',
        year_group:            'year-7',
        difficulty_lane:       lane,
        lesson_type:           'core_lesson',
        estimated_minutes:     LANE_MINUTES[lane],
        app_experience:        LANE_EXPERIENCE[lane],
        status:                'published',
        verification_method:   'curriculum_outcome_mapping',
        verification_status:   'verified',
        source_reference:      outcome?.source_reference ?? `NC KS3 ${topic.subject.name} | ${topic.title}`,
      }

      const existing = await prisma.lesson.findFirst({ where: { slug } })
      if (existing) {
        await prisma.lesson.update({ where: { id: existing.id }, data })
        topicUpdated++
        totalUpdated++
      } else {
        await prisma.lesson.create({ data: { slug, ...data } })
        topicCreated++
        totalCreated++
      }
    }

    const tierSummary = activeTiers.join(', ')
    console.log(`  ✅ ${topic.subject.name.padEnd(10)} ${topic.title.padEnd(45)} [${tierSummary}] +${topicCreated} ↻${topicUpdated}`)
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  const total = await prisma.lesson.count({
    where: { year_group: 'year-7', status: 'published', verification_status: 'verified' },
  })

  console.log(`\n══════════════════════════════════════════════════════════════════`)
  console.log(`  Created: ${totalCreated}  Updated: ${totalUpdated}  Topics skipped (no questions): ${totalSkipped}`)
  console.log(`  Total published+verified Y7 lessons in DB: ${total}`)
  console.log(`══════════════════════════════════════════════════════════════════\n`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed error:', e.message)
  prisma.$disconnect()
  process.exit(1)
})
