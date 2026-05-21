/**
 * Curriculum Coverage Spine — Seed Script
 *
 * Seeds England National Curriculum (2014) outcomes for:
 *   - KS1 Mathematics (Years 1–2), domain: Number – multiplication and division
 *   - KS2 Mathematics (Years 3–6), domain: Number – multiplication and division
 *
 * Maps the 3 Year 3 outcomes to the existing "Multiplication Tables" app topic.
 * All other outcomes are seeded as "unmapped" (no app topic exists yet for them).
 *
 * Source: Mathematics programmes of study: key stages 1 and 2
 *         National curriculum in England (DFE-00178-2013, updated July 2014)
 *
 * Idempotent: deletes all existing curriculum_outcomes rows before re-inserting.
 *
 * Run: node --env-file=.env.local scripts/seed-curriculum-ks2-maths.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Known app IDs (from seed-topics.py / seed-phase4.mjs) ────────────────────
const MATHS_SUBJECT_ID     = '1f769381-bd81-40c2-a84c-bb5c777a89ad'
const MULTIPLICATION_TOPIC = 'd8089833-9cb5-4714-aa4b-01713c072a7e' // Multiplication Tables, Year 3

// ── Content-type requirements by key stage ────────────────────────────────────
const KS1_TYPES        = ['learn', 'practice', 'quiz_sprout']
const LOWER_KS2_TYPES  = ['learn', 'practice', 'quiz_sprout', 'quiz_explorer']
const UPPER_KS2_TYPES  = ['learn', 'practice', 'quiz_sprout', 'quiz_explorer', 'quiz_lightning']

// ── Outcome definitions ───────────────────────────────────────────────────────
// Fields: key_stage, year_group, domain, statutory_outcome,
//         non_statutory_notes?, source_reference, app_topic_id?,
//         app_skill_id?, required_content_types, coverage_status

const OUTCOMES = [
  // ════════════════════════════════════════════════════════════════
  //  KS1 — Year 1 — Number: multiplication and division
  // ════════════════════════════════════════════════════════════════
  {
    key_stage:     'KS1',
    year_group:    'Year 1',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Count in multiples of twos, fives and tens.',
    source_reference: 'NC 2014 Maths KS1 Y1 MD-001 | DFE-00178-2013 p.8',
    app_skill_id:  'count_in_multiples_2_5_10',
    required_content_types: KS1_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS1',
    year_group:    'Year 1',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve one-step problems involving multiplication and division, by calculating the answer using concrete objects, pictorial representations and arrays with the support of the teacher.',
    source_reference: 'NC 2014 Maths KS1 Y1 MD-002 | DFE-00178-2013 p.8',
    app_skill_id:  'one_step_mul_div_problems_y1',
    required_content_types: KS1_TYPES,
    coverage_status: 'unmapped',
  },

  // ════════════════════════════════════════════════════════════════
  //  KS1 — Year 2 — Number: multiplication and division
  // ════════════════════════════════════════════════════════════════
  {
    key_stage:     'KS1',
    year_group:    'Year 2',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Recall and use multiplication and division facts for the 2, 5 and 10 multiplication tables, including recognising odd and even numbers.',
    source_reference: 'NC 2014 Maths KS1 Y2 MD-001 | DFE-00178-2013 p.14',
    app_skill_id:  'times_tables_recall_2_5_10',
    required_content_types: KS1_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS1',
    year_group:    'Year 2',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Calculate mathematical statements for multiplication and division within the multiplication tables and write them using the multiplication (×), division (÷) and equals (=) signs.',
    source_reference: 'NC 2014 Maths KS1 Y2 MD-002 | DFE-00178-2013 p.14',
    app_skill_id:  'write_mul_div_statements_y2',
    required_content_types: KS1_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS1',
    year_group:    'Year 2',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Show that multiplication of two numbers can be done in any order (commutative) and division of one number by another cannot.',
    source_reference: 'NC 2014 Maths KS1 Y2 MD-003 | DFE-00178-2013 p.14',
    app_skill_id:  'commutativity_y2',
    required_content_types: KS1_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS1',
    year_group:    'Year 2',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve problems involving multiplication and division, using materials, arrays, repeated addition, mental methods, and multiplication and division facts, including problems in context.',
    source_reference: 'NC 2014 Maths KS1 Y2 MD-004 | DFE-00178-2013 p.14',
    app_skill_id:  'mul_div_problems_y2',
    required_content_types: KS1_TYPES,
    coverage_status: 'unmapped',
  },

  // ════════════════════════════════════════════════════════════════
  //  KS2 — Year 3 — Number: multiplication and division
  //  MAPPED to "Multiplication Tables" app topic
  // ════════════════════════════════════════════════════════════════
  {
    key_stage:     'KS2',
    year_group:    'Year 3',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Recall and use multiplication and division facts for the 3, 4 and 8 multiplication tables.',
    source_reference: 'NC 2014 Maths KS2 Y3 MD-001 | DFE-00178-2013 p.24',
    app_subject_id:  MATHS_SUBJECT_ID,
    app_topic_id:    MULTIPLICATION_TOPIC,
    app_skill_id:    'times_tables_recall_3_4_8',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'mapped',
    verification_status: 'verified',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 3',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Write and calculate mathematical statements for multiplication and division using the multiplication tables that they know, including for two-digit numbers times one-digit numbers, using mental and progressing to formal written methods.',
    source_reference: 'NC 2014 Maths KS2 Y3 MD-002 | DFE-00178-2013 p.24',
    app_subject_id:  MATHS_SUBJECT_ID,
    app_topic_id:    MULTIPLICATION_TOPIC,
    app_skill_id:    'write_calculate_mul_div_y3',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'mapped',
    verification_status: 'verified',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 3',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve problems, including missing number problems, involving multiplication and division, including positive integer scaling problems and correspondence problems in which n objects are connected to m objects.',
    source_reference: 'NC 2014 Maths KS2 Y3 MD-003 | DFE-00178-2013 p.24',
    app_subject_id:  MATHS_SUBJECT_ID,
    app_topic_id:    MULTIPLICATION_TOPIC,
    app_skill_id:    'mul_div_problems_y3',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'mapped',
    verification_status: 'verified',
  },

  // ════════════════════════════════════════════════════════════════
  //  KS2 — Year 4 — Number: multiplication and division
  // ════════════════════════════════════════════════════════════════
  {
    key_stage:     'KS2',
    year_group:    'Year 4',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Recall multiplication and division facts for multiplication tables up to 12 × 12.',
    source_reference: 'NC 2014 Maths KS2 Y4 MD-001 | DFE-00178-2013 p.28',
    app_skill_id:  'times_tables_recall_to_12x12',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 4',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Use place value, known and derived facts to multiply and divide mentally, including: multiplying by 0 and 1; dividing by 1; multiplying together three numbers.',
    source_reference: 'NC 2014 Maths KS2 Y4 MD-002 | DFE-00178-2013 p.28',
    app_skill_id:  'mental_mul_div_place_value_y4',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 4',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Recognise and use factor pairs and commutativity in mental calculations.',
    source_reference: 'NC 2014 Maths KS2 Y4 MD-003 | DFE-00178-2013 p.28',
    app_skill_id:  'factor_pairs_commutativity_y4',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 4',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Multiply two-digit and three-digit numbers by a one-digit number using formal written layout.',
    source_reference: 'NC 2014 Maths KS2 Y4 MD-004 | DFE-00178-2013 p.28',
    app_skill_id:  'short_mul_written_y4',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 4',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve problems involving multiplying and adding, including using the distributive law to multiply two-digit numbers by one digit, integer scaling problems and harder correspondence problems such as n objects are connected to m objects.',
    source_reference: 'NC 2014 Maths KS2 Y4 MD-005 | DFE-00178-2013 p.28',
    app_skill_id:  'mul_problems_distributive_y4',
    required_content_types: LOWER_KS2_TYPES,
    coverage_status: 'unmapped',
  },

  // ════════════════════════════════════════════════════════════════
  //  KS2 — Year 5 — Number: multiplication and division
  // ════════════════════════════════════════════════════════════════
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Identify multiples and factors, including finding all factor pairs of a number, and common factors of two numbers.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-001 | DFE-00178-2013 p.38',
    app_skill_id:  'multiples_factors_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Know and use the vocabulary of prime numbers, prime factors and composite (non-prime) numbers.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-002 | DFE-00178-2013 p.38',
    app_skill_id:  'prime_composite_vocabulary_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Establish whether a number up to 100 is prime and recall prime numbers up to 19.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-003 | DFE-00178-2013 p.38',
    app_skill_id:  'identify_primes_to_100_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Multiply numbers up to 4 digits by a one- or two-digit number using a formal written method, including long multiplication for two-digit numbers.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-004 | DFE-00178-2013 p.38',
    app_skill_id:  'long_mul_written_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Multiply and divide numbers mentally drawing upon known facts.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-005 | DFE-00178-2013 p.38',
    app_skill_id:  'mental_mul_div_known_facts_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Divide numbers up to 4 digits by a one-digit number using the formal written method of short division and interpret remainders appropriately for the context.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-006 | DFE-00178-2013 p.38',
    app_skill_id:  'short_div_written_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Multiply and divide whole numbers and those involving decimals by 10, 100 and 1000.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-007 | DFE-00178-2013 p.38',
    app_skill_id:  'mul_div_10_100_1000_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Recognise and use square numbers and cube numbers, and the notation for squared (²) and cubed (³).',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-008 | DFE-00178-2013 p.38',
    app_skill_id:  'squares_cubes_notation_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve problems involving multiplication and division, including using their knowledge of factors and multiples, squares and cubes.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-009 | DFE-00178-2013 p.38',
    app_skill_id:  'mul_div_problems_factors_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve problems involving addition, subtraction, multiplication and division and a combination of these, including understanding the meaning of the equals sign.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-010 | DFE-00178-2013 p.38',
    app_skill_id:  'four_ops_combined_problems_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 5',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve problems involving multiplication and division, including scaling by simple fractions and problems involving simple rates.',
    source_reference: 'NC 2014 Maths KS2 Y5 MD-011 | DFE-00178-2013 p.38',
    app_skill_id:  'mul_div_scaling_fractions_y5',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },

  // ════════════════════════════════════════════════════════════════
  //  KS2 — Year 6 — Number: multiplication and division
  // ════════════════════════════════════════════════════════════════
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Multiply multi-digit numbers up to 4 digits by a two-digit whole number using the formal written method of long multiplication.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-001 | DFE-00178-2013 p.43',
    app_skill_id:  'long_mul_4digit_by_2digit_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Divide numbers up to 4 digits by a two-digit whole number using the formal written method of long division, and interpret remainders as whole number remainders, fractions, or by rounding, as appropriate for the context.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-002 | DFE-00178-2013 p.43',
    app_skill_id:  'long_div_4digit_by_2digit_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Divide numbers up to 4 digits by a two-digit number using the formal written method of short division where appropriate, interpreting remainders according to the context.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-003 | DFE-00178-2013 p.43',
    app_skill_id:  'short_div_2digit_divisor_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Perform mental calculations, including with mixed operations and large numbers.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-004 | DFE-00178-2013 p.43',
    app_skill_id:  'mental_calc_mixed_ops_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Identify common factors, common multiples and prime numbers.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-005 | DFE-00178-2013 p.43',
    app_skill_id:  'common_factors_multiples_primes_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Use their knowledge of the order of operations to carry out calculations involving the four operations.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-006 | DFE-00178-2013 p.43',
    app_skill_id:  'order_of_operations_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Solve problems involving addition, subtraction, multiplication and division.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-007 | DFE-00178-2013 p.43',
    app_skill_id:  'four_ops_problems_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
  {
    key_stage:     'KS2',
    year_group:    'Year 6',
    domain:        'Number – multiplication and division',
    statutory_outcome:
      'Use estimation to check answers to calculations and determine, in the context of a problem, an appropriate degree of accuracy.',
    source_reference: 'NC 2014 Maths KS2 Y6 MD-008 | DFE-00178-2013 p.43',
    app_skill_id:  'estimation_accuracy_y6',
    required_content_types: UPPER_KS2_TYPES,
    coverage_status: 'unmapped',
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  Curriculum Coverage Spine — Seed')
  console.log('  Scope: England NC KS1+KS2 — Mathematics')
  console.log('  Domain: Number – multiplication and division')
  console.log('══════════════════════════════════════════════════════════════════\n')

  // 1. Verify the Maths subject and Multiplication Tables topic exist
  const mathsSubject = await prisma.subject.findUnique({ where: { id: MATHS_SUBJECT_ID } })
  if (!mathsSubject) {
    console.error(`❌ Maths subject (${MATHS_SUBJECT_ID}) not found. Run seed-topics.py first.`)
    process.exit(1)
  }
  const multTopic = await prisma.topic.findUnique({ where: { id: MULTIPLICATION_TOPIC } })
  if (!multTopic) {
    console.error(`❌ Multiplication Tables topic (${MULTIPLICATION_TOPIC}) not found. Run seed-topics.py first.`)
    process.exit(1)
  }
  console.log(`✅ Maths subject found: "${mathsSubject.name}"`)
  console.log(`✅ Multiplication Tables topic found: "${multTopic.title}"`)
  console.log()

  // 2. Idempotent — delete all existing outcomes for this domain
  const deleted = await prisma.curriculumOutcome.deleteMany({
    where: { domain: 'Number – multiplication and division' },
  })
  console.log(`🗑  Cleared ${deleted.count} existing outcomes for this domain`)

  // 3. Insert all outcomes
  let seeded = 0
  let mapped  = 0
  for (const o of OUTCOMES) {
    await prisma.curriculumOutcome.create({
      data: {
        framework_country:      'England',
        framework_name:         'National Curriculum 2014',
        key_stage:              o.key_stage,
        year_group:             o.year_group,
        subject:                'Mathematics',
        domain:                 o.domain,
        statutory_outcome:      o.statutory_outcome,
        non_statutory_notes:    o.non_statutory_notes ?? null,
        source_reference:       o.source_reference,
        app_subject_id:         o.app_subject_id ?? null,
        app_topic_id:           o.app_topic_id ?? null,
        app_skill_id:           o.app_skill_id ?? null,
        required_content_types: o.required_content_types,
        coverage_status:        o.coverage_status ?? 'unmapped',
        verification_status:    o.verification_status ?? 'unverified',
      },
    })
    seeded++
    if (o.app_topic_id) mapped++
  }

  // 4. Summary
  const ks1Count = OUTCOMES.filter(o => o.key_stage === 'KS1').length
  const ks2Count = OUTCOMES.filter(o => o.key_stage === 'KS2').length

  console.log(`\n  Seeded ${seeded} outcomes total`)
  console.log(`    KS1 (Years 1–2): ${ks1Count}`)
  console.log(`    KS2 (Years 3–6): ${ks2Count}`)
  console.log(`    Mapped to app topics: ${mapped}`)
  console.log(`    Unmapped: ${seeded - mapped}`)

  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('  Seed complete. Run verify-curriculum-coverage.mjs to check coverage.')
  console.log('══════════════════════════════════════════════════════════════════\n')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed error:', e.message)
  process.exit(1)
})
