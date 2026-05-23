/**
 * Seed England NC 2014 English outcomes for Year 3/4 (KS2) into curriculum_outcomes.
 *
 * Source: English programmes of study: key stages 1 and 2
 *         National curriculum in England (DFE-00178-2013, updated July 2014)
 *         Statutory requirements for Years 3 and 4.
 *
 * AI must not generate statutory outcomes — text is verbatim from the statutory document.
 *
 * Idempotent: uses upsert on source_reference. Run safely multiple times.
 *
 * Run: npx ts-node --env-file=.env.local scripts/seed-outcomes-english-y3.ts
 *   or: npx tsx --env-file=.env.local scripts/seed-outcomes-english-y3.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const KS2_LOWER_TYPES = ['learn', 'practice', 'quiz_sprout', 'quiz_explorer']

// Verbatim from DfE NC 2014 English KS2 Year 3/4 programme of study.
const OUTCOMES = [
  // ── Reading — Word reading ───────────────────────────────────────────────
  {
    domain: 'Reading – word reading',
    statutory_outcome:
      'Apply their growing knowledge of root words, prefixes and suffixes (morphology and etymology), as listed in Appendix 1 of the statutory guidance, both to read aloud and to understand the meaning of new words that they meet.',
    source_reference: 'NC 2014 English KS2 Y3/4 RWR-001 | DFE-00178-2013 p.26',
  },
  // ── Reading — Comprehension ──────────────────────────────────────────────
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Listen to and discuss a wide range of fiction, poetry, plays, non-fiction and reference books or textbooks.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-001 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Read books that are structured in different ways and reading for a range of purposes.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-002 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Use dictionaries to check the meaning of words that they have read.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-003 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Increase their familiarity with a wide range of books, including fairy stories, myths and legends, and retelling some of these orally.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-004 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Identify themes and conventions in a wide range of books.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-005 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Prepare poems and play scripts to read aloud and to perform, showing understanding through intonation, tone, volume and action.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-006 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Discuss words and phrases that capture the reader\'s interest and imagination.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-007 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Recognise some different forms of poetry [for example, free verse, narrative poetry].',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-008 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Check that the text makes sense to them, discussing their understanding and explaining the meaning of words in context.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-009 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Ask questions to improve their understanding of a text.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-010 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Draw inferences such as inferring characters\' feelings, thoughts and motives from their actions, and justifying inferences with evidence.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-011 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Predict what might happen from details stated and implied.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-012 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Identify main ideas drawn from more than one paragraph and summarising these.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-013 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Identify how language, structure, and presentation contribute to meaning.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-014 | DFE-00178-2013 p.27',
  },
  {
    domain: 'Reading – comprehension',
    statutory_outcome:
      'Retrieve and record information from non-fiction.',
    source_reference: 'NC 2014 English KS2 Y3/4 RC-015 | DFE-00178-2013 p.27',
  },
  // ── Writing — Vocabulary, grammar and punctuation ────────────────────────
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Develop their understanding of the concepts set out in Appendix 2 of the statutory guidance by extending the range of sentences with more than one clause by using a wider range of conjunctions, including when, if, because, although.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-001 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Use the present perfect form of verbs in contrast to the past tense.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-002 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Choose nouns or pronouns appropriately for clarity and cohesion and to avoid repetition.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-003 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Use conjunctions, adverbs and prepositions to express time and cause.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-004 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Use fronted adverbials.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-005 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Learn the grammar for years 3 and 4 in English Appendix 2.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-006 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Use and punctuate direct speech.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-007 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Use commas after fronted adverbials.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-008 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Indicate possession by using the possessive apostrophe with plural nouns.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-009 | DFE-00178-2013 p.30',
  },
  {
    domain: 'Writing – vocabulary, grammar and punctuation',
    statutory_outcome:
      'Use and understand the grammatical terminology in English Appendix 2 accurately and appropriately when discussing their writing and reading.',
    source_reference: 'NC 2014 English KS2 Y3/4 WVGP-010 | DFE-00178-2013 p.30',
  },
  // ── Spelling ─────────────────────────────────────────────────────────────
  {
    domain: 'Spelling',
    statutory_outcome:
      'Use further prefixes and suffixes and understand how to add them (English Appendix 1).',
    source_reference: 'NC 2014 English KS2 Y3/4 SP-001 | DFE-00178-2013 p.28',
  },
  {
    domain: 'Spelling',
    statutory_outcome:
      'Spell further homophones.',
    source_reference: 'NC 2014 English KS2 Y3/4 SP-002 | DFE-00178-2013 p.28',
  },
  {
    domain: 'Spelling',
    statutory_outcome:
      'Spell words that are often misspelt (English Appendix 1).',
    source_reference: 'NC 2014 English KS2 Y3/4 SP-003 | DFE-00178-2013 p.28',
  },
  {
    domain: 'Spelling',
    statutory_outcome:
      'Place the possessive apostrophe accurately in words with regular plurals [for example, girls\', boys\'] and in words with irregular plurals [for example, children\'s].',
    source_reference: 'NC 2014 English KS2 Y3/4 SP-004 | DFE-00178-2013 p.28',
  },
  {
    domain: 'Spelling',
    statutory_outcome:
      'Use the first two or three letters of a word to check its spelling in a dictionary.',
    source_reference: 'NC 2014 English KS2 Y3/4 SP-005 | DFE-00178-2013 p.28',
  },
  {
    domain: 'Spelling',
    statutory_outcome:
      'Write from memory simple sentences, dictated by the teacher, that include words and punctuation taught so far.',
    source_reference: 'NC 2014 English KS2 Y3/4 SP-006 | DFE-00178-2013 p.28',
  },
] as const

async function main() {
  console.log('Seeding Year 3 English curriculum outcomes...\n')

  let upserted = 0
  let skipped = 0

  const englishSubject = await prisma.subject.findFirst({
    where: { name: { contains: 'English', mode: 'insensitive' } },
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
          subject: 'English',
          domain: outcome.domain,
          statutory_outcome: outcome.statutory_outcome,
          source_reference: outcome.source_reference,
          app_subject_id: englishSubject?.id ?? null,
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
