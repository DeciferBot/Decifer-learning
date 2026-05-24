/**
 * Seed Year 2 (KS1) year_group, zones, and topics for Maths, English, and Science.
 *
 * Creates:
 *   - year_groups record: year-2 (KS1)
 *   - 3 zones: Counting Kingdom (Maths), Story Seeds (English), Nature Path (Science)
 *   - Maths topics: 6 Y2 KS1 Maths topics
 *   - English topics: 5 Y2 KS1 English topics
 *   - Science topics: 4 Y2 KS1 Science topics
 *
 * Idempotent: safe to run multiple times.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-year2.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Year 2 (KS1) — year_group, zones, and topics...\n')

  // ── 1. Year group ──────────────────────────────────────────────────────
  let yearGroup = await prisma.yearGroup.findFirst({ where: { label: 'year-2' } })
  if (!yearGroup) {
    yearGroup = await prisma.yearGroup.create({
      data: { label: 'year-2', key_stage: 'KS1' },
    })
    console.log('  ✅ Created year_group: year-2 (KS1)')
  } else {
    console.log('  ⏭  year_group year-2 already exists')
  }

  // ── 2. Subjects ────────────────────────────────────────────────────────
  const mathsSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'Maths', mode: 'insensitive' } },
  })
  const englishSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'English', mode: 'insensitive' } },
  })
  const scienceSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'Science', mode: 'insensitive' } },
  })

  if (!mathsSubject || !englishSubject || !scienceSubject) {
    console.error('  ❌ One or more subjects not found. Run seed-phase4.mjs first.')
    return
  }

  // ── 3. Zones ───────────────────────────────────────────────────────────
  const zoneData = [
    { subject: mathsSubject, name: 'Counting Kingdom', theme: 'kingdom' },
    { subject: englishSubject, name: 'Story Seeds', theme: 'garden' },
    { subject: scienceSubject, name: 'Nature Path', theme: 'forest' },
  ]

  const zones: Record<string, { id: string }> = {}
  for (const z of zoneData) {
    let zone = await prisma.zone.findFirst({
      where: { year_group_id: yearGroup.id, subject_id: z.subject.id },
    })
    if (!zone) {
      zone = await prisma.zone.create({
        data: {
          year_group_id: yearGroup.id,
          subject_id: z.subject.id,
          name: z.name,
          theme: z.theme,
          illustration_url: null,
          guardian_quiz_id: null,
        },
      })
      console.log(`  ✅ Created zone: ${z.name} (Year 2 ${z.subject.name})`)
    } else {
      console.log(`  ⏭  Zone for Year 2 ${z.subject.name} already exists: ${zone.name}`)
    }
    zones[z.subject.name.toLowerCase()] = zone
  }

  // ── 4. Topics ──────────────────────────────────────────────────────────

  const mathsTopics = [
    { title: 'Number: Place Value to 100', slug: 'y2-maths-place-value-100', order_index: 1 },
    { title: 'Addition and Subtraction to 100', slug: 'y2-maths-addition-subtraction', order_index: 2 },
    { title: 'Multiplication: 2, 5 and 10 Times Tables', slug: 'y2-maths-multiplication-tables', order_index: 3 },
    { title: 'Fractions: Halves, Thirds and Quarters', slug: 'y2-maths-fractions', order_index: 4 },
    { title: 'Measurement: Length, Mass and Temperature', slug: 'y2-maths-measurement', order_index: 5 },
    { title: 'Geometry: 2D and 3D Shapes', slug: 'y2-maths-geometry-shapes', order_index: 6 },
  ]

  const englishTopics = [
    { title: 'Phonics: Common Phonemes and Digraphs', slug: 'y2-english-phonics', order_index: 1 },
    { title: 'Spelling: Common Exception Words', slug: 'y2-english-spelling-exceptions', order_index: 2 },
    { title: 'Grammar: Nouns, Adjectives and Verbs', slug: 'y2-english-grammar-word-classes', order_index: 3 },
    { title: 'Grammar: Sentences and Punctuation', slug: 'y2-english-grammar-sentences', order_index: 4 },
    { title: 'Reading: Comprehension and Sequencing', slug: 'y2-english-reading-comprehension', order_index: 5 },
  ]

  const scienceTopics = [
    { title: 'Living Things and Their Habitats', slug: 'y2-science-living-things-habitats', order_index: 1 },
    { title: 'Plants: Growth and Needs', slug: 'y2-science-plants-growth', order_index: 2 },
    { title: 'Animals: Food, Survival and Life Cycles', slug: 'y2-science-animals-survival', order_index: 3 },
    { title: 'Everyday Materials and Their Properties', slug: 'y2-science-materials-properties', order_index: 4 },
  ]

  const topicSets = [
    { topics: mathsTopics, subject: mathsSubject, zoneKey: 'maths' },
    { topics: englishTopics, subject: englishSubject, zoneKey: 'english' },
    { topics: scienceTopics, subject: scienceSubject, zoneKey: 'science' },
  ]

  let totalCreated = 0
  let totalSkipped = 0

  for (const { topics, subject, zoneKey } of topicSets) {
    const zone = zones[zoneKey]
    console.log(`\n  ${subject.name} topics:`)
    for (const topic of topics) {
      const existing = await prisma.topic.findFirst({
        where: { subject_id: subject.id, slug: topic.slug },
      })
      if (existing) {
        console.log(`    ⏭  Skipped: ${topic.title}`)
        totalSkipped++
        continue
      }
      try {
        await prisma.topic.create({
          data: {
            subject_id: subject.id,
            year_group_id: yearGroup.id,
            title: topic.title,
            slug: topic.slug,
            order_index: topic.order_index,
            is_published: false,
            zone_id: zone?.id ?? null,
          },
        })
        console.log(`    ✅ Created: ${topic.title}`)
        totalCreated++
      } catch (err) {
        console.error(`    ❌ Failed: ${topic.title} — ${err}`)
      }
    }
  }

  console.log(`\n  Topics created: ${totalCreated}, skipped: ${totalSkipped}`)
  console.log('\n  Next steps:')
  console.log('  1. Run seed-chunks-maths-y2.ts, seed-chunks-english-y2.ts, seed-chunks-science-y2.ts')
  console.log('  2. Run embed_chunks.py on the DO droplet to compute embeddings')
  console.log('  3. Run generate-batch-y2.py on the DO droplet')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
