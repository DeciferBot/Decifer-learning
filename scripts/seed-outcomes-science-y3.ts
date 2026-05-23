/**
 * Seed England NC 2014 Science outcomes for Year 3 (Lower KS2) into curriculum_outcomes.
 *
 * Source: Science programmes of study: key stages 1 and 2
 *         National curriculum in England (DFE-00178-2013, updated July 2014)
 *         Year 3 statutory programme of study.
 *
 * AI must not generate statutory outcomes — text is verbatim from the statutory document.
 *
 * Idempotent: uses source_reference as unique key. Run safely multiple times.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-outcomes-science-y3.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const KS2_LOWER_TYPES = ['learn', 'practice', 'quiz_sprout', 'quiz_explorer']

// Verbatim from DfE NC 2014 Science Year 3 programme of study.
const OUTCOMES = [
  // ── Plants ───────────────────────────────────────────────────────────────
  {
    domain: 'Plants',
    statutory_outcome:
      'Identify and describe the functions of different parts of flowering plants: roots, stem/trunk, leaves and flowers.',
    source_reference: 'NC 2014 Science KS2 Y3 Plants-001 | DFE-00178-2013 p.20',
  },
  {
    domain: 'Plants',
    statutory_outcome:
      'Explore the requirements of plants for life and growth (air, light, water, nutrients from soil, and room to grow) and how they vary from plant to plant.',
    source_reference: 'NC 2014 Science KS2 Y3 Plants-002 | DFE-00178-2013 p.20',
  },
  {
    domain: 'Plants',
    statutory_outcome:
      'Investigate the way in which water is transported within plants.',
    source_reference: 'NC 2014 Science KS2 Y3 Plants-003 | DFE-00178-2013 p.20',
  },
  {
    domain: 'Plants',
    statutory_outcome:
      'Explore the part that flowers play in the life cycle of flowering plants, including pollination, seed formation and seed dispersal.',
    source_reference: 'NC 2014 Science KS2 Y3 Plants-004 | DFE-00178-2013 p.20',
  },
  // ── Animals including humans ──────────────────────────────────────────────
  {
    domain: 'Animals including humans',
    statutory_outcome:
      'Identify that animals, including humans, need the right types and amount of nutrition, and that they cannot make their own food; they get nutrition from what they eat.',
    source_reference: 'NC 2014 Science KS2 Y3 AIH-001 | DFE-00178-2013 p.21',
  },
  {
    domain: 'Animals including humans',
    statutory_outcome:
      'Identify that humans and some other animals have skeletons and muscles for support, protection and movement.',
    source_reference: 'NC 2014 Science KS2 Y3 AIH-002 | DFE-00178-2013 p.21',
  },
  // ── Rocks ────────────────────────────────────────────────────────────────
  {
    domain: 'Rocks',
    statutory_outcome:
      'Compare and group together different kinds of rocks on the basis of their appearance and simple physical properties.',
    source_reference: 'NC 2014 Science KS2 Y3 Rocks-001 | DFE-00178-2013 p.21',
  },
  {
    domain: 'Rocks',
    statutory_outcome:
      'Describe in simple terms how fossils are formed when things that have lived are trapped within rock.',
    source_reference: 'NC 2014 Science KS2 Y3 Rocks-002 | DFE-00178-2013 p.21',
  },
  {
    domain: 'Rocks',
    statutory_outcome:
      'Recognise that soils are made from rocks and organic matter.',
    source_reference: 'NC 2014 Science KS2 Y3 Rocks-003 | DFE-00178-2013 p.21',
  },
  // ── Light ────────────────────────────────────────────────────────────────
  {
    domain: 'Light',
    statutory_outcome:
      'Recognise that they need light in order to see things and that dark is the absence of light.',
    source_reference: 'NC 2014 Science KS2 Y3 Light-001 | DFE-00178-2013 p.22',
  },
  {
    domain: 'Light',
    statutory_outcome:
      'Notice that light is reflected from surfaces.',
    source_reference: 'NC 2014 Science KS2 Y3 Light-002 | DFE-00178-2013 p.22',
  },
  {
    domain: 'Light',
    statutory_outcome:
      'Recognise that light from the sun can be dangerous and that there are ways to protect their eyes.',
    source_reference: 'NC 2014 Science KS2 Y3 Light-003 | DFE-00178-2013 p.22',
  },
  {
    domain: 'Light',
    statutory_outcome:
      'Recognise that shadows are formed when the light from a light source is blocked by an opaque object.',
    source_reference: 'NC 2014 Science KS2 Y3 Light-004 | DFE-00178-2013 p.22',
  },
  {
    domain: 'Light',
    statutory_outcome:
      'Find patterns in the way that the size of shadows change.',
    source_reference: 'NC 2014 Science KS2 Y3 Light-005 | DFE-00178-2013 p.22',
  },
  // ── Forces and magnets ────────────────────────────────────────────────────
  {
    domain: 'Forces and magnets',
    statutory_outcome:
      'Compare how things move on different surfaces.',
    source_reference: 'NC 2014 Science KS2 Y3 FM-001 | DFE-00178-2013 p.23',
  },
  {
    domain: 'Forces and magnets',
    statutory_outcome:
      'Notice that some forces need contact between two objects, but magnetic forces can act at a distance.',
    source_reference: 'NC 2014 Science KS2 Y3 FM-002 | DFE-00178-2013 p.23',
  },
  {
    domain: 'Forces and magnets',
    statutory_outcome:
      'Observe how magnets attract or repel each other and attract some materials and not others.',
    source_reference: 'NC 2014 Science KS2 Y3 FM-003 | DFE-00178-2013 p.23',
  },
  {
    domain: 'Forces and magnets',
    statutory_outcome:
      'Compare and group together a variety of everyday materials on the basis of whether they are attracted to a magnet, and identify some magnetic materials.',
    source_reference: 'NC 2014 Science KS2 Y3 FM-004 | DFE-00178-2013 p.23',
  },
  {
    domain: 'Forces and magnets',
    statutory_outcome:
      'Describe magnets as having two poles.',
    source_reference: 'NC 2014 Science KS2 Y3 FM-005 | DFE-00178-2013 p.23',
  },
  {
    domain: 'Forces and magnets',
    statutory_outcome:
      'Predict whether two magnets will attract or repel each other, depending on which poles are facing.',
    source_reference: 'NC 2014 Science KS2 Y3 FM-006 | DFE-00178-2013 p.23',
  },
] as const

async function main() {
  console.log('Seeding Year 3 Science curriculum outcomes...\n')

  let upserted = 0
  let skipped = 0

  const scienceSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'Science', mode: 'insensitive' } },
  })

  for (const outcome of OUTCOMES) {
    try {
      const existing = await prisma.curriculumOutcome.findFirst({
        where: { source_reference: outcome.source_reference },
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.curriculumOutcome.create({
        data: {
          framework_country: 'England',
          framework_name: 'National Curriculum 2014',
          key_stage: 'KS2',
          year_group: 'Year 3',
          subject: 'Science',
          domain: outcome.domain,
          statutory_outcome: outcome.statutory_outcome,
          source_reference: outcome.source_reference,
          app_subject_id: scienceSubject?.id ?? null,
          required_content_types: KS2_LOWER_TYPES,
          coverage_status: 'unmapped',
          verification_status: 'unverified',
        },
      })
      upserted++
    } catch (err) {
      console.error(`  ❌ Failed: ${outcome.source_reference} — ${err}`)
    }
  }

  console.log(`  ✅ Seeded: ${upserted} outcomes`)
  console.log(`  ⏭  Skipped (already exist): ${skipped}`)
  console.log(`  Total: ${OUTCOMES.length} outcomes`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
