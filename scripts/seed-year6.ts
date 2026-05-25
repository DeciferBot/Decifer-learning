/**
 * Seed Year 6 (KS2) year_group, zones, and topics for Maths, English, and Science.
 *
 * Creates:
 *   - year_groups record: year-6 (KS2)
 *   - 3 zones: Fraction Forest (Maths), Authors' Archive (English), Evolution Expedition (Science)
 *   - Maths topics: 6 Y6 KS2 Maths topics
 *   - English topics: 5 Y6 KS2 English topics
 *   - Science topics: 4 Y6 KS2 Science topics
 *
 * Idempotent: safe to run multiple times.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-year6.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Year 6 (KS2) — year_group, zones, and topics...\n')

  // ── 1. Year group ──────────────────────────────────────────────────────
  let yearGroup = await prisma.yearGroup.findFirst({ where: { label: 'year-6' } })
  if (!yearGroup) {
    yearGroup = await prisma.yearGroup.create({
      data: { label: 'year-6', key_stage: 'KS2' },
    })
    console.log('  ✅ Created year_group: year-6 (KS2)')
  } else {
    console.log('  ⏭  year_group year-6 already exists')
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
    { subject: mathsSubject, name: 'Fraction Forest', theme: 'forest' },
    { subject: englishSubject, name: "Authors' Archive", theme: 'library' },
    { subject: scienceSubject, name: 'Evolution Expedition', theme: 'expedition' },
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
      console.log(`  ✅ Created zone: ${z.name} (Year 6 ${z.subject.name})`)
    } else {
      console.log(`  ⏭  Zone for Year 6 ${z.subject.name} already exists: ${zone.name}`)
    }
    zones[z.subject.name.toLowerCase()] = zone
  }

  // ── 4. Topics ──────────────────────────────────────────────────────────

  const mathsTopics = [
    { title: 'Number: Place Value and Rounding', slug: 'y6-maths-place-value-rounding', order_index: 1 },
    { title: 'Fractions, Decimals and Percentages', slug: 'y6-maths-fractions-decimals-percentages', order_index: 2 },
    { title: 'Algebra: Expressions and Equations', slug: 'y6-maths-algebra-expressions', order_index: 3 },
    { title: 'Ratio and Proportion', slug: 'y6-maths-ratio-proportion', order_index: 4 },
    { title: 'Geometry: Properties of Shapes', slug: 'y6-maths-geometry-shapes', order_index: 5 },
    { title: 'Statistics: Mean, Charts and Graphs', slug: 'y6-maths-statistics', order_index: 6 },
  ]

  const englishTopics = [
    { title: 'Grammar: Subjunctive and Passive Voice', slug: 'y6-english-grammar-subjunctive-passive', order_index: 1 },
    { title: 'Punctuation: Colons, Semi-colons and Dashes', slug: 'y6-english-punctuation-advanced', order_index: 2 },
    { title: 'Vocabulary: Synonyms, Antonyms and Etymology', slug: 'y6-english-vocabulary-etymology', order_index: 3 },
    { title: 'Reading: Inference and Authorial Intent', slug: 'y6-english-reading-inference', order_index: 4 },
    { title: 'Writing: Narrative Techniques and Structure', slug: 'y6-english-writing-narrative', order_index: 5 },
  ]

  const scienceTopics = [
    { title: 'Evolution and Inheritance', slug: 'y6-science-evolution-inheritance', order_index: 1 },
    { title: 'Living Things: Classification of Organisms', slug: 'y6-science-living-things-classification', order_index: 2 },
    { title: 'Animals Including Humans: Circulatory System', slug: 'y6-science-circulatory-system', order_index: 3 },
    { title: 'Light: Reflection, Refraction and the Eye', slug: 'y6-science-light', order_index: 4 },
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
  console.log('  1. Run seed-chunks-maths-y6.ts, seed-chunks-english-y6.ts, seed-chunks-science-y6.ts')
  console.log('  2. Run embed_chunks.py on the DO droplet to compute embeddings')
  console.log('  3. Run generate-batch-y6.py on the DO droplet')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
