/**
 * Seed Year 3 English topics into the topics table.
 *
 * Topics are seeded with is_published=false. They will not appear in the
 * child-facing world map until content gates pass and publish-topic is run.
 *
 * Idempotent: skips topics that already exist by (subject_id, slug).
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-topics-english.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPICS = [
  // Year 3 English — Whispering Woods zone
  {
    title: 'Grammar: Conjunctions and Clauses',
    slug: 'y3-english-grammar-conjunctions',
    order_index: 1,
  },
  {
    title: 'Grammar: Verb Tenses',
    slug: 'y3-english-grammar-verb-tenses',
    order_index: 2,
  },
  {
    title: 'Grammar: Fronted Adverbials',
    slug: 'y3-english-grammar-fronted-adverbials',
    order_index: 3,
  },
  {
    title: 'Grammar: Apostrophes',
    slug: 'y3-english-grammar-apostrophes',
    order_index: 4,
  },
  {
    title: 'Spelling: Prefixes and Suffixes',
    slug: 'y3-english-spelling-prefixes-suffixes',
    order_index: 5,
  },
  {
    title: 'Spelling: Common Exceptions and Homophones',
    slug: 'y3-english-spelling-homophones',
    order_index: 6,
  },
  {
    title: 'Reading: Comprehension and Inference',
    slug: 'y3-english-reading-comprehension',
    order_index: 7,
  },
  {
    title: 'Reading: Vocabulary in Context',
    slug: 'y3-english-reading-vocabulary',
    order_index: 8,
  },
] as const

async function main() {
  console.log('Seeding Year 3 English topics...\n')

  // Look up subject and year group
  const englishSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'English', mode: 'insensitive' } },
  })
  if (!englishSubject) {
    console.error('  ❌ English subject not found. Run seed-phase4.mjs first.')
    return
  }

  const yearGroup = await prisma.yearGroup.findFirst({
    where: { label: 'year-3' },
  })
  if (!yearGroup) {
    console.error('  ❌ Year 3 year_group not found. Run seed-phase4.mjs first.')
    return
  }

  // Look up the Whispering Woods zone for Year 3 English
  const zone = await prisma.zone.findFirst({
    where: {
      year_group_id: yearGroup.id,
      subject_id: englishSubject.id,
    },
  })

  let created = 0
  let skipped = 0

  for (const topic of TOPICS) {
    try {
      const existing = await prisma.topic.findFirst({
        where: {
          subject_id: englishSubject.id,
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
          subject_id: englishSubject.id,
          year_group_id: yearGroup.id,
          title: topic.title,
          slug: topic.slug,
          order_index: topic.order_index,
          is_published: false, // not published until content gates pass
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
