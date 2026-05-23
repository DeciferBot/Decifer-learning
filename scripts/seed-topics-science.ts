/**
 * Seed Year 3 Science topics into the topics table.
 *
 * Topics are seeded with is_published=false. They will not appear in the
 * child-facing world map until content gates pass and publish-topic is run.
 *
 * Idempotent: skips topics that already exist by (subject_id, slug).
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-topics-science.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPICS = [
  // Year 3 Science — Discovery Cave zone
  {
    title: 'Plants: Parts and Functions',
    slug: 'y3-science-plants-parts-functions',
    order_index: 1,
  },
  {
    title: 'Plants: Life Cycle and Pollination',
    slug: 'y3-science-plants-life-cycle',
    order_index: 2,
  },
  {
    title: 'Animals: Nutrition and Skeletons',
    slug: 'y3-science-animals-nutrition-skeletons',
    order_index: 3,
  },
  {
    title: 'Rocks: Types and Fossils',
    slug: 'y3-science-rocks-fossils',
    order_index: 4,
  },
  {
    title: 'Light: Sources, Reflection and Shadows',
    slug: 'y3-science-light-shadows',
    order_index: 5,
  },
  {
    title: 'Forces and Magnets',
    slug: 'y3-science-forces-magnets',
    order_index: 6,
  },
] as const

async function main() {
  console.log('Seeding Year 3 Science topics...\n')

  const scienceSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'Science', mode: 'insensitive' } },
  })
  if (!scienceSubject) {
    console.error('  ❌ Science subject not found. Run seed-phase4.mjs first.')
    return
  }

  const yearGroup = await prisma.yearGroup.findFirst({
    where: { label: 'year-3' },
  })
  if (!yearGroup) {
    console.error('  ❌ Year 3 year_group not found. Run seed-phase4.mjs first.')
    return
  }

  const zone = await prisma.zone.findFirst({
    where: {
      year_group_id: yearGroup.id,
      subject_id: scienceSubject.id,
    },
  })

  let created = 0
  let skipped = 0

  for (const topic of TOPICS) {
    try {
      const existing = await prisma.topic.findFirst({
        where: {
          subject_id: scienceSubject.id,
          slug: topic.slug,
        },
      })

      if (existing) {
        console.log(`  ⏭  Skipped: ${topic.title}`)
        skipped++
        continue
      }

      await prisma.topic.create({
        data: {
          subject_id: scienceSubject.id,
          year_group_id: yearGroup.id,
          title: topic.title,
          slug: topic.slug,
          order_index: topic.order_index,
          is_published: false,
          zone_id: zone?.id ?? null,
        },
      })
      console.log(`  ✅ Created: ${topic.title}`)
      created++
    } catch (err) {
      console.error(`  ❌ Failed: ${topic.title} — ${err}`)
    }
  }

  console.log(`\n  Created: ${created}, Skipped: ${skipped}`)
  console.log('\n  NOTE: Topics are is_published=false. Run publish-topic.ts after content gates pass.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
