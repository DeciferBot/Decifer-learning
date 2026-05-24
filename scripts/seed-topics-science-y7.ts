/**
 * Seed Year 7 Science topics into the topics table.
 *
 * Year 7 Science zone: Elemental Forge (KS3).
 * Topics are seeded with is_published=false. They will not appear in the
 * child-facing world map until content gates pass and publish-topic is run.
 *
 * Idempotent: skips topics that already exist by subject + slug.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-topics-science-y7.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPICS = [
  // Year 7 Science — Elemental Forge zone (KS3)
  {
    title: 'Cells: Structure and Organisation',
    slug: 'y7-science-cells-structure',
    order_index: 1,
  },
  {
    title: 'Reproduction in Plants and Animals',
    slug: 'y7-science-reproduction',
    order_index: 2,
  },
  {
    title: 'Ecosystems: Food Chains and Webs',
    slug: 'y7-science-ecosystems-food-chains',
    order_index: 3,
  },
  {
    title: 'Chemistry: Particles and States of Matter',
    slug: 'y7-science-particles-states-of-matter',
    order_index: 4,
  },
  {
    title: 'Chemistry: Elements, Compounds and Mixtures',
    slug: 'y7-science-elements-compounds-mixtures',
    order_index: 5,
  },
  {
    title: 'Physics: Forces and Motion',
    slug: 'y7-science-forces-motion',
    order_index: 6,
  },
  {
    title: 'Physics: Energy Stores and Transfers',
    slug: 'y7-science-energy-stores-transfers',
    order_index: 7,
  },
  {
    title: 'Physics: Space and the Solar System',
    slug: 'y7-science-space-solar-system',
    order_index: 8,
  },
] as const

async function main() {
  console.log('Seeding Year 7 Science topics...\n')

  const scienceSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'Science', mode: 'insensitive' } },
  })
  if (!scienceSubject) {
    console.error('  ❌ Science subject not found. Run seed-phase4.mjs first.')
    return
  }

  let yearGroup = await prisma.yearGroup.findFirst({
    where: { label: 'year-7' },
  })
  if (!yearGroup) {
    yearGroup = await prisma.yearGroup.create({
      data: { label: 'year-7', key_stage: 'KS3' },
    })
    console.log('  ✅ Created year_group: year-7 (KS3)')
  }

  // Find or create the Elemental Forge zone for Year 7 Science
  let zone = await prisma.zone.findFirst({
    where: { year_group_id: yearGroup.id, subject_id: scienceSubject.id },
  })
  if (!zone) {
    zone = await prisma.zone.create({
      data: {
        year_group_id: yearGroup.id,
        subject_id: scienceSubject.id,
        name: 'Elemental Forge',
        theme: 'forge',
        illustration_url: null,
        guardian_quiz_id: null,
      },
    })
    console.log('  ✅ Created zone: Elemental Forge (Year 7 Science)')
  }

  let created = 0
  let skipped = 0

  for (const topic of TOPICS) {
    try {
      const existing = await prisma.topic.findFirst({
        where: { subject_id: scienceSubject.id, slug: topic.slug },
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
          zone_id: zone.id,
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
