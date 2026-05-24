/**
 * Seed Year 7 English topics into the topics table.
 *
 * Year 7 English zone: Library of Echoes (KS3).
 * Topics are seeded with is_published=false. They will not appear in the
 * child-facing world map until content gates pass and publish-topic is run.
 *
 * Idempotent: skips topics that already exist by subject + slug.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-topics-english-y7.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPICS = [
  // Year 7 English — Library of Echoes zone (KS3)
  {
    title: 'Grammar: Sentence Types and Structures',
    slug: 'y7-english-grammar-sentence-types',
    order_index: 1,
  },
  {
    title: 'Grammar: Punctuation for Effect',
    slug: 'y7-english-grammar-punctuation-effect',
    order_index: 2,
  },
  {
    title: 'Grammar: Standard and Non-Standard English',
    slug: 'y7-english-grammar-standard-english',
    order_index: 3,
  },
  {
    title: 'Vocabulary: Word Families and Etymology',
    slug: 'y7-english-vocabulary-word-families',
    order_index: 4,
  },
  {
    title: 'Reading: Inference and Textual Evidence',
    slug: 'y7-english-reading-inference',
    order_index: 5,
  },
  {
    title: 'Reading: Language and Structure Analysis',
    slug: 'y7-english-reading-language-analysis',
    order_index: 6,
  },
  {
    title: 'Writing: Persuasive Techniques',
    slug: 'y7-english-writing-persuasive',
    order_index: 7,
  },
  {
    title: 'Literature: Character and Motivation',
    slug: 'y7-english-literature-character',
    order_index: 8,
  },
] as const

async function main() {
  console.log('Seeding Year 7 English topics...\n')

  const englishSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'English', mode: 'insensitive' } },
  })
  if (!englishSubject) {
    console.error('  ❌ English subject not found. Run seed-phase4.mjs first.')
    return
  }

  // Create year-7 year_group if it doesn't exist yet
  let yearGroup = await prisma.yearGroup.findFirst({
    where: { label: 'year-7' },
  })
  if (!yearGroup) {
    yearGroup = await prisma.yearGroup.create({
      data: { label: 'year-7', key_stage: 'KS3' },
    })
    console.log('  ✅ Created year_group: year-7 (KS3)')
  }

  // Find or create the Library of Echoes zone for Year 7 English
  let zone = await prisma.zone.findFirst({
    where: { year_group_id: yearGroup.id, subject_id: englishSubject.id },
  })
  if (!zone) {
    zone = await prisma.zone.create({
      data: {
        year_group_id: yearGroup.id,
        subject_id: englishSubject.id,
        name: 'Library of Echoes',
        theme: 'library',
        illustration_url: null,
        guardian_quiz_id: null,
      },
    })
    console.log('  ✅ Created zone: Library of Echoes (Year 7 English)')
  }

  let created = 0
  let skipped = 0

  for (const topic of TOPICS) {
    try {
      const existing = await prisma.topic.findFirst({
        where: { subject_id: englishSubject.id, slug: topic.slug },
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
