/**
 * Seed missing Maths topics for Year 3 and Year 7
 *
 * Year 3 Maths (KS2) — NC England 2014:
 *   Currently: Multiplication Tables (order_index=1)
 *   Adding: 8 more topics to complete the Y3 Maths spine
 *
 * Year 7 Maths (KS3) — NC England 2014:
 *   Currently: Algebra: Solving Linear Equations (order_index=1)
 *   Adding: 9 more topics to complete the Y7 Maths spine
 *
 * Topics are set is_published=false — the pipeline must generate and
 * publish content before they appear to children.
 *
 * Idempotent: safe to re-run (upserts by slug).
 *
 * Run: node --env-file=.env.local scripts/seed-maths-topics-y3-y7.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MATHS_SUBJECT_ID = '1f769381-bd81-40c2-a84c-bb5c777a89ad'

const Y3_YEAR_GROUP_ID  = 'b81752f5-ae00-4b14-a7fe-f4be1eac5453'
const Y3_ZONE_ID        = '7eb272a0-0799-428a-9744-62fafd8389b8'  // Number Jungle

const Y7_YEAR_GROUP_ID  = '6f858189-5913-406f-a3c8-4597942aa69d'
const Y7_ZONE_ID        = '7d221de9-9363-43c6-807c-547125adbc8f'  // Crystal Labyrinth

// ── Y3 Maths topics (NC KS2 Year 3) ──────────────────────────────────────────
// order_index=1 already used by Multiplication Tables → start from 2
const Y3_MATHS_TOPICS = [
  {
    order_index: 2,
    slug: 'y3-maths-place-value',
    title: 'Number: Place Value',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 3,
    slug: 'y3-maths-addition-subtraction',
    title: 'Number: Addition and Subtraction',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 4,
    slug: 'y3-maths-multiplication-division',
    title: 'Number: Multiplication and Division',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 5,
    slug: 'y3-maths-fractions',
    title: 'Number: Fractions',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 6,
    slug: 'y3-maths-measurement-length-perimeter',
    title: 'Measurement: Length and Perimeter',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 7,
    slug: 'y3-maths-measurement-mass-capacity',
    title: 'Measurement: Mass and Capacity',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 8,
    slug: 'y3-maths-measurement-time',
    title: 'Measurement: Time',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 9,
    slug: 'y3-maths-geometry-shapes',
    title: 'Geometry: Properties of Shapes',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 10,
    slug: 'y3-maths-statistics',
    title: 'Statistics: Bar Charts and Pictograms',
    pedagogy_mode: 'instruction_first',
  },
]

// ── Y7 Maths topics (NC KS3 Year 7) ──────────────────────────────────────────
// order_index=1 already used by Algebra: Solving Linear Equations → start from 2
const Y7_MATHS_TOPICS = [
  {
    order_index: 2,
    slug: 'y7-maths-place-value-integers',
    title: 'Number: Integers, Powers and Roots',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 3,
    slug: 'y7-maths-fractions-decimals-percentages',
    title: 'Number: Fractions, Decimals and Percentages',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 4,
    slug: 'y7-maths-ratio-proportion',
    title: 'Ratio and Proportion',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 5,
    slug: 'y7-maths-algebra-sequences',
    title: 'Algebra: Sequences and nth Term',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 6,
    slug: 'y7-maths-algebra-graphs',
    title: 'Algebra: Graphs and Coordinates',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 7,
    slug: 'y7-maths-geometry-angles',
    title: 'Geometry: Angles and Constructions',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 8,
    slug: 'y7-maths-geometry-area-perimeter',
    title: 'Geometry: Area and Perimeter',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 9,
    slug: 'y7-maths-statistics-data',
    title: 'Statistics: Data, Averages and Range',
    pedagogy_mode: 'instruction_first',
  },
  {
    order_index: 10,
    slug: 'y7-maths-probability',
    title: 'Probability: Basic Probability',
    pedagogy_mode: 'instruction_first',
  },
]

async function seedTopics(topics, yearGroupId, zoneId, yearLabel, ks) {
  let created = 0, skipped = 0
  for (const t of topics) {
    const existing = await prisma.topic.findFirst({ where: { slug: t.slug } })
    if (existing) {
      console.log(`  ↺ Already exists: "${t.slug}"`)
      skipped++
      continue
    }
    await prisma.topic.create({
      data: {
        subject_id:    MATHS_SUBJECT_ID,
        year_group_id: yearGroupId,
        zone_id:       zoneId,
        title:         t.title,
        slug:          t.slug,
        order_index:   t.order_index,
        pedagogy_mode: t.pedagogy_mode,
        is_published:  false,  // pipeline must generate content first
      },
    })
    console.log(`  ✅ Created: [${t.order_index}] ${t.title}`)
    created++
  }
  return { created, skipped }
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  Maths topic spine seed — Year 3 (KS2) + Year 7 (KS3)')
  console.log('══════════════════════════════════════════════════════════════════\n')

  console.log('── Year 3 Maths (Number Jungle) ─────────────────────────────────')
  const y3 = await seedTopics(Y3_MATHS_TOPICS, Y3_YEAR_GROUP_ID, Y3_ZONE_ID, 'year-3', 'KS2')

  console.log('\n── Year 7 Maths (Crystal Labyrinth) ─────────────────────────────')
  const y7 = await seedTopics(Y7_MATHS_TOPICS, Y7_YEAR_GROUP_ID, Y7_ZONE_ID, 'year-7', 'KS3')

  const y3total = await prisma.topic.count({ where: { year_group_id: Y3_YEAR_GROUP_ID, subject_id: MATHS_SUBJECT_ID } })
  const y7total = await prisma.topic.count({ where: { year_group_id: Y7_YEAR_GROUP_ID, subject_id: MATHS_SUBJECT_ID } })

  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log(`  Y3: ${y3.created} created, ${y3.skipped} skipped → ${y3total} total Y3 Maths topics`)
  console.log(`  Y7: ${y7.created} created, ${y7.skipped} skipped → ${y7total} total Y7 Maths topics`)
  console.log('\n  ⚠️  Topics are is_published=FALSE — run the content pipeline next:')
  console.log('     node --env-file=.env.local scripts/learning-autopilot-run.mjs')
  console.log('══════════════════════════════════════════════════════════════════\n')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Seed error:', e.message)
  prisma.$disconnect()
  process.exit(1)
})
