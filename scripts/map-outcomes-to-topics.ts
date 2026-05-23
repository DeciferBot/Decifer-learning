/**
 * Map curriculum_outcomes to app topics by updating app_topic_id and coverage_status.
 *
 * This script links the statutory outcomes seeded by seed-outcomes-english-y3.ts
 * and seed-outcomes-science-y3.ts to the topics seeded by seed-topics-english.ts
 * and seed-topics-science.ts.
 *
 * Idempotent: safe to run multiple times.
 *
 * Run: npx tsx --env-file=.env.local scripts/map-outcomes-to-topics.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// outcome source_reference → topic slug
const OUTCOME_TO_TOPIC_SLUG: Record<string, string> = {
  // ── English Year 3 ──────────────────────────────────────────────────────
  'NC 2014 English KS2 Y3/4 WVGP-001 | DFE-00178-2013 p.30': 'y3-english-grammar-conjunctions',
  'NC 2014 English KS2 Y3/4 WVGP-002 | DFE-00178-2013 p.30': 'y3-english-grammar-verb-tenses',
  'NC 2014 English KS2 Y3/4 WVGP-003 | DFE-00178-2013 p.30': 'y3-english-grammar-conjunctions',
  'NC 2014 English KS2 Y3/4 WVGP-004 | DFE-00178-2013 p.30': 'y3-english-grammar-conjunctions',
  'NC 2014 English KS2 Y3/4 WVGP-005 | DFE-00178-2013 p.30': 'y3-english-grammar-fronted-adverbials',
  'NC 2014 English KS2 Y3/4 WVGP-006 | DFE-00178-2013 p.30': 'y3-english-grammar-conjunctions',
  'NC 2014 English KS2 Y3/4 WVGP-007 | DFE-00178-2013 p.30': 'y3-english-grammar-apostrophes',
  'NC 2014 English KS2 Y3/4 WVGP-008 | DFE-00178-2013 p.30': 'y3-english-grammar-fronted-adverbials',
  'NC 2014 English KS2 Y3/4 WVGP-009 | DFE-00178-2013 p.30': 'y3-english-grammar-apostrophes',
  'NC 2014 English KS2 Y3/4 WVGP-010 | DFE-00178-2013 p.30': 'y3-english-grammar-conjunctions',
  'NC 2014 English KS2 Y3/4 SP-001 | DFE-00178-2013 p.28':   'y3-english-spelling-prefixes-suffixes',
  'NC 2014 English KS2 Y3/4 SP-002 | DFE-00178-2013 p.28':   'y3-english-spelling-homophones',
  'NC 2014 English KS2 Y3/4 SP-003 | DFE-00178-2013 p.28':   'y3-english-spelling-homophones',
  'NC 2014 English KS2 Y3/4 SP-004 | DFE-00178-2013 p.28':   'y3-english-grammar-apostrophes',
  'NC 2014 English KS2 Y3/4 SP-005 | DFE-00178-2013 p.28':   'y3-english-spelling-homophones',
  'NC 2014 English KS2 Y3/4 SP-006 | DFE-00178-2013 p.28':   'y3-english-spelling-homophones',
  'NC 2014 English KS2 Y3/4 RC-009 | DFE-00178-2013 p.27':   'y3-english-reading-comprehension',
  'NC 2014 English KS2 Y3/4 RC-010 | DFE-00178-2013 p.27':   'y3-english-reading-comprehension',
  'NC 2014 English KS2 Y3/4 RC-011 | DFE-00178-2013 p.27':   'y3-english-reading-comprehension',
  'NC 2014 English KS2 Y3/4 RC-012 | DFE-00178-2013 p.27':   'y3-english-reading-comprehension',
  'NC 2014 English KS2 Y3/4 RC-013 | DFE-00178-2013 p.27':   'y3-english-reading-comprehension',
  'NC 2014 English KS2 Y3/4 RC-014 | DFE-00178-2013 p.27':   'y3-english-reading-comprehension',
  'NC 2014 English KS2 Y3/4 RC-015 | DFE-00178-2013 p.27':   'y3-english-reading-comprehension',
  'NC 2014 English KS2 Y3/4 RC-003 | DFE-00178-2013 p.27':   'y3-english-reading-vocabulary',
  'NC 2014 English KS2 Y3/4 RC-007 | DFE-00178-2013 p.27':   'y3-english-reading-vocabulary',
  // ── Science Year 3 ──────────────────────────────────────────────────────
  'NC 2014 Science KS2 Y3 Plants-001 | DFE-00178-2013 p.20': 'y3-science-plants-parts-functions',
  'NC 2014 Science KS2 Y3 Plants-002 | DFE-00178-2013 p.20': 'y3-science-plants-parts-functions',
  'NC 2014 Science KS2 Y3 Plants-003 | DFE-00178-2013 p.20': 'y3-science-plants-parts-functions',
  'NC 2014 Science KS2 Y3 Plants-004 | DFE-00178-2013 p.20': 'y3-science-plants-life-cycle',
  'NC 2014 Science KS2 Y3 AIH-001 | DFE-00178-2013 p.21':    'y3-science-animals-nutrition-skeletons',
  'NC 2014 Science KS2 Y3 AIH-002 | DFE-00178-2013 p.21':    'y3-science-animals-nutrition-skeletons',
  'NC 2014 Science KS2 Y3 Rocks-001 | DFE-00178-2013 p.21':  'y3-science-rocks-fossils',
  'NC 2014 Science KS2 Y3 Rocks-002 | DFE-00178-2013 p.21':  'y3-science-rocks-fossils',
  'NC 2014 Science KS2 Y3 Rocks-003 | DFE-00178-2013 p.21':  'y3-science-rocks-fossils',
  'NC 2014 Science KS2 Y3 Light-001 | DFE-00178-2013 p.22':  'y3-science-light-shadows',
  'NC 2014 Science KS2 Y3 Light-002 | DFE-00178-2013 p.22':  'y3-science-light-shadows',
  'NC 2014 Science KS2 Y3 Light-003 | DFE-00178-2013 p.22':  'y3-science-light-shadows',
  'NC 2014 Science KS2 Y3 Light-004 | DFE-00178-2013 p.22':  'y3-science-light-shadows',
  'NC 2014 Science KS2 Y3 Light-005 | DFE-00178-2013 p.22':  'y3-science-light-shadows',
  'NC 2014 Science KS2 Y3 FM-001 | DFE-00178-2013 p.23':     'y3-science-forces-magnets',
  'NC 2014 Science KS2 Y3 FM-002 | DFE-00178-2013 p.23':     'y3-science-forces-magnets',
  'NC 2014 Science KS2 Y3 FM-003 | DFE-00178-2013 p.23':     'y3-science-forces-magnets',
  'NC 2014 Science KS2 Y3 FM-004 | DFE-00178-2013 p.23':     'y3-science-forces-magnets',
  'NC 2014 Science KS2 Y3 FM-005 | DFE-00178-2013 p.23':     'y3-science-forces-magnets',
  'NC 2014 Science KS2 Y3 FM-006 | DFE-00178-2013 p.23':     'y3-science-forces-magnets',
}

async function main() {
  console.log('Mapping curriculum outcomes to app topics...\n')

  let mapped = 0
  let notFound = 0
  let unchanged = 0

  for (const [sourceRef, topicSlug] of Object.entries(OUTCOME_TO_TOPIC_SLUG)) {
    const outcome = await prisma.curriculumOutcome.findFirst({
      where: { source_reference: sourceRef },
    })

    if (!outcome) {
      console.log(`  ⚠️  Outcome not found: ${sourceRef}`)
      notFound++
      continue
    }

    const topic = await prisma.topic.findFirst({
      where: { slug: topicSlug },
    })

    if (!topic) {
      console.log(`  ⚠️  Topic not found: ${topicSlug}`)
      notFound++
      continue
    }

    if (outcome.app_topic_id === topic.id) {
      unchanged++
      continue
    }

    await prisma.curriculumOutcome.update({
      where: { id: outcome.id },
      data: {
        app_topic_id: topic.id,
        coverage_status: 'mapped',
      },
    })
    console.log(`  ✅ Mapped: ${sourceRef.split(' | ')[0]} → ${topic.title}`)
    mapped++
  }

  console.log(`\n  Mapped: ${mapped}, Unchanged: ${unchanged}, Not found: ${notFound}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
