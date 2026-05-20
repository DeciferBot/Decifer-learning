/**
 * Phase 4.1 seed — replace duplicate quiz questions for Multiplication Tables.
 *
 * Deletes all existing quiz_questions for the topic and inserts 15 varied,
 * arithmetically-verified questions spanning sprout / explorer / lightning tiers.
 *
 * Idempotent: re-running replaces all rows cleanly.
 *
 * Run: DATABASE_URL='...' DIRECT_URL='...' node scripts/seed-phase4.1-quiz.mjs
 */

import { PrismaClient } from '@prisma/client'

const TOPIC_ID = 'd8089833-9cb5-4714-aa4b-01713c072a7e' // Multiplication Tables, Year 3 Maths

const prisma = new PrismaClient()

// Inline arithmetic verifier — mirrors what the pipeline maths.py verifier does.
function verify(a, op, b, expected) {
  const result = op === '*' ? a * b : null
  if (result === null) throw new Error(`Unknown operator: ${op}`)
  if (result !== expected)
    throw new Error(`Arithmetic error: ${a} ${op} ${b} = ${result}, expected ${expected}`)
}

const QUESTIONS = [
  // ── Sprout tier (simpler 2x, 3x, 5x, 10x tables) ─────────────────────────
  {
    tier: 'sprout',
    question_text: 'What is 2 × 4?',
    question_type: 'maths_arithmetic',
    correct_answer: '8',
    distractors: ['6', '10', '16'],
    hint_1: 'Think of 2 groups of 4.',
    hint_2: 'Count in 2s, four times: 2, 4, 6, …',
    hint_3: '2 + 2 + 2 + 2 = ?',
    explanation: '2 × 4 means 2 groups of 4. 4 + 4 = 8.',
    confidence_score: 0.95,
    _verify: [2, '*', 4, 8],
  },
  {
    tier: 'sprout',
    question_text: 'What is 3 × 5?',
    question_type: 'maths_arithmetic',
    correct_answer: '15',
    distractors: ['12', '18', '20'],
    hint_1: 'Think of 3 groups of 5.',
    hint_2: 'Count in 5s, three times: 5, 10, …',
    hint_3: '5 + 5 + 5 = ?',
    explanation: '3 × 5 means 3 groups of 5. 5 + 5 + 5 = 15.',
    confidence_score: 0.95,
    _verify: [3, '*', 5, 15],
  },
  {
    tier: 'sprout',
    question_text: 'What is 5 × 7?',
    question_type: 'maths_arithmetic',
    correct_answer: '35',
    distractors: ['30', '40', '45'],
    hint_1: 'Count up in 5s seven times.',
    hint_2: '5, 10, 15, 20, 25, 30, …',
    hint_3: 'The answer is between 30 and 40.',
    explanation: '5 × 7 = 35. Count in 5s: 5, 10, 15, 20, 25, 30, 35.',
    confidence_score: 0.95,
    _verify: [5, '*', 7, 35],
  },
  {
    tier: 'sprout',
    question_text: 'What is 10 × 4?',
    question_type: 'maths_arithmetic',
    correct_answer: '40',
    distractors: ['30', '44', '50'],
    hint_1: 'The 10 times table — just add a zero!',
    hint_2: '4 with a zero on the end is …',
    hint_3: 'The answer ends in 0.',
    explanation: '10 × 4 = 40. For any 10× fact, write the other number and add a zero.',
    confidence_score: 0.95,
    _verify: [10, '*', 4, 40],
  },
  {
    tier: 'sprout',
    question_text: 'What is 2 × 9?',
    question_type: 'maths_arithmetic',
    correct_answer: '18',
    distractors: ['16', '20', '27'],
    hint_1: '2 × 9 is the same as double 9.',
    hint_2: 'Double 9: 9 + 9 = ?',
    hint_3: 'The answer is between 16 and 20.',
    explanation: '2 × 9 = 18. Doubling 9 gives 9 + 9 = 18.',
    confidence_score: 0.95,
    _verify: [2, '*', 9, 18],
  },

  // ── Explorer tier (4x, 6x, 7x, 8x tables) ────────────────────────────────
  {
    tier: 'explorer',
    question_text: 'What is 4 × 6?',
    question_type: 'maths_arithmetic',
    correct_answer: '24',
    distractors: ['20', '28', '16'],
    hint_1: 'Double 6, then double again.',
    hint_2: '6 doubled is 12. Now double 12.',
    hint_3: '12 + 12 = ?',
    explanation: '4 × 6 = 24. A good trick: 4 × 6 = double 6, then double again. 6 → 12 → 24.',
    confidence_score: 0.92,
    _verify: [4, '*', 6, 24],
  },
  {
    tier: 'explorer',
    question_text: 'What is 6 × 7?',
    question_type: 'maths_arithmetic',
    correct_answer: '42',
    distractors: ['36', '48', '40'],
    hint_1: 'Count up in 6s seven times.',
    hint_2: '6, 12, 18, 24, 30, 36, …',
    hint_3: 'The answer is between 40 and 45.',
    explanation: '6 × 7 = 42. Count in 6s: 6, 12, 18, 24, 30, 36, 42.',
    confidence_score: 0.92,
    _verify: [6, '*', 7, 42],
  },
  {
    tier: 'explorer',
    question_text: 'What is 8 × 9?',
    question_type: 'maths_arithmetic',
    correct_answer: '72',
    distractors: ['63', '81', '64'],
    hint_1: 'Count up in 8s nine times — or try 9 × 8.',
    hint_2: 'Think: 8 × 10 = 80. Now take away one 8.',
    hint_3: '80 − 8 = ?',
    explanation: '8 × 9 = 72. Trick: 8 × 10 = 80, then 80 − 8 = 72.',
    confidence_score: 0.92,
    _verify: [8, '*', 9, 72],
  },
  {
    tier: 'explorer',
    question_text: 'What is 4 × 9?',
    question_type: 'maths_arithmetic',
    correct_answer: '36',
    distractors: ['32', '40', '45'],
    hint_1: 'Try 4 × 10 first, then take away 4.',
    hint_2: '4 × 10 = 40. Now subtract 4.',
    hint_3: '40 − 4 = ?',
    explanation: '4 × 9 = 36. Trick: 4 × 10 = 40, then 40 − 4 = 36.',
    confidence_score: 0.92,
    _verify: [4, '*', 9, 36],
  },
  {
    tier: 'explorer',
    question_text: 'What is 7 × 8?',
    question_type: 'maths_arithmetic',
    correct_answer: '56',
    distractors: ['49', '63', '54'],
    hint_1: 'Count up in 7s eight times — or flip it to 8 × 7.',
    hint_2: '7, 14, 21, 28, 35, 42, 49, …',
    hint_3: 'The answer is between 54 and 60.',
    explanation: '7 × 8 = 56. Count in 8s: 8, 16, 24, 32, 40, 48, 56.',
    confidence_score: 0.92,
    _verify: [7, '*', 8, 56],
  },

  // ── Lightning tier (harder square numbers and 9x table) ───────────────────
  {
    tier: 'lightning',
    question_text: 'What is 9 × 9?',
    question_type: 'maths_arithmetic',
    correct_answer: '81',
    distractors: ['72', '90', '78'],
    hint_1: '9 × 9 is a square number.',
    hint_2: 'Try 9 × 10 = 90, then take away 9.',
    hint_3: '90 − 9 = ?',
    explanation: '9 × 9 = 81. Trick: 9 × 10 = 90, minus one 9 gives 81.',
    confidence_score: 0.9,
    _verify: [9, '*', 9, 81],
  },
  {
    tier: 'lightning',
    question_text: 'What is 7 × 7?',
    question_type: 'maths_arithmetic',
    correct_answer: '49',
    distractors: ['42', '56', '48'],
    hint_1: '7 × 7 is a square number — it is 7 groups of 7.',
    hint_2: '7 × 6 = 42. Add one more 7.',
    hint_3: '42 + 7 = ?',
    explanation: '7 × 7 = 49. Square numbers come from multiplying a number by itself.',
    confidence_score: 0.9,
    _verify: [7, '*', 7, 49],
  },
  {
    tier: 'lightning',
    question_text: 'What is 8 × 8?',
    question_type: 'maths_arithmetic',
    correct_answer: '64',
    distractors: ['56', '72', '63'],
    hint_1: '8 × 8 is a square number.',
    hint_2: '8 × 7 = 56. Add one more 8.',
    hint_3: '56 + 8 = ?',
    explanation: '8 × 8 = 64. Building up: 8 × 7 = 56, then 56 + 8 = 64.',
    confidence_score: 0.9,
    _verify: [8, '*', 8, 64],
  },
  {
    tier: 'lightning',
    question_text: 'What is 6 × 9?',
    question_type: 'maths_arithmetic',
    correct_answer: '54',
    distractors: ['48', '63', '45'],
    hint_1: 'Try 6 × 10, then take away 6.',
    hint_2: '6 × 10 = 60. Subtract one 6.',
    hint_3: '60 − 6 = ?',
    explanation: '6 × 9 = 54. Trick: 6 × 10 = 60, then 60 − 6 = 54.',
    confidence_score: 0.9,
    _verify: [6, '*', 9, 54],
  },
  {
    tier: 'lightning',
    question_text: 'What is 5 × 9?',
    question_type: 'maths_arithmetic',
    correct_answer: '45',
    distractors: ['40', '50', '54'],
    hint_1: 'Try 5 × 10, then take away 5.',
    hint_2: '5 × 10 = 50. Subtract one 5.',
    hint_3: '50 − 5 = ?',
    explanation: '5 × 9 = 45. The ×9 trick: multiply by 10 and subtract the number. 50 − 5 = 45.',
    confidence_score: 0.9,
    _verify: [5, '*', 9, 45],
  },
]

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Phase 4.1 seed — varied quiz questions')
  console.log('══════════════════════════════════════════════\n')

  // Inline arithmetic verification before touching the DB
  console.log('  Verifying all answers arithmetically…')
  for (const q of QUESTIONS) {
    const [a, op, b, expected] = q._verify
    verify(a, op, b, expected)
  }
  console.log(`  ✅ All ${QUESTIONS.length} answers verified`)

  // Check for duplicate question_text
  const texts = QUESTIONS.map((q) => q.question_text)
  const uniqueTexts = new Set(texts)
  if (uniqueTexts.size !== texts.length) {
    throw new Error('Duplicate question_text found in seed data — fix the seed before inserting')
  }

  // Check for duplicate correct_answer
  const answers = QUESTIONS.map((q) => q.correct_answer)
  const uniqueAnswers = new Set(answers)
  if (uniqueAnswers.size !== answers.length) {
    throw new Error(
      'Duplicate correct_answer found in seed data — questions must have unique answers'
    )
  }
  console.log('  ✅ No duplicate texts or answers in seed data\n')

  const topic = await prisma.topic.findUnique({ where: { id: TOPIC_ID } })
  if (!topic) throw new Error(`Topic ${TOPIC_ID} not found — run Phase 3 seed first`)
  console.log(`  Topic: "${topic.title}"`)

  // Delete all existing questions for this topic (they are all duplicates)
  const { count } = await prisma.quizQuestion.deleteMany({ where: { topic_id: TOPIC_ID } })
  console.log(`  Deleted ${count} existing question(s)`)

  // Insert the new varied set
  const inserts = QUESTIONS.map(({ _verify: _v, ...q }) => ({
    topic_id: TOPIC_ID,
    status: 'published',
    ...q,
  }))

  await prisma.quizQuestion.createMany({ data: inserts })
  console.log(`  ✅ Inserted ${inserts.length} varied published questions`)

  // Summary breakdown by tier
  const byTier = {}
  for (const q of QUESTIONS) {
    byTier[q.tier] = (byTier[q.tier] ?? 0) + 1
  }
  for (const [tier, n] of Object.entries(byTier)) {
    console.log(`     ${tier}: ${n}`)
  }

  console.log('\nPhase 4.1 seed complete.\n')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e.message)
  process.exit(1)
})
