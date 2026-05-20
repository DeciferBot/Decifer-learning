/**
 * Phase 6 seed — Year 7 Maths topic: Algebra: Solving Linear Equations.
 *
 * Seeds:
 *  1. topics row (Crystal Labyrinth zone, year-7, Maths)
 *  2. learn_content row (published)
 *  3. practice_games row (fill_blank)
 *  4. 15 quiz_questions (5 sprout / 5 explorer / 5 lightning, published)
 *
 * All correct_answers are verified algebraically before insert.
 * Idempotent: re-running deletes and re-inserts only Phase 6 rows.
 *
 * Run: node --env-file=.env.local scripts/seed-phase6.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Known IDs (from Phase 2/3 seeds) ─────────────────────────────────────
const YEAR_7_ID     = '6f858189-5913-406f-a3c8-4597942aa69d'
const MATHS_ID      = '1f769381-bd81-40c2-a84c-bb5c777a89ad'
const CRYSTAL_ZONE  = '7d221de9-9363-43c6-807c-547125adbc8f'

// ── Inline algebraic verifier ─────────────────────────────────────────────
// Supports: one-step (x ± a = b, ax = b) and two-step (ax ± b = c, ax ± b = cx ± d)
function solveLinear({ lhsCoeff, lhsConst, rhsCoeff, rhsConst }) {
  // (lhsCoeff)x + lhsConst = (rhsCoeff)x + rhsConst
  // (lhsCoeff - rhsCoeff)x = rhsConst - lhsConst
  const coeffDiff = lhsCoeff - rhsCoeff
  const constDiff = rhsConst - lhsConst
  if (coeffDiff === 0) throw new Error('No unique solution: coefficient difference is 0')
  const x = constDiff / coeffDiff
  if (!Number.isFinite(x)) throw new Error(`Non-finite solution: ${x}`)
  return x
}

function assertAnswer(params, expected) {
  const x = solveLinear(params)
  // Round to 4dp to avoid floating-point artefacts
  const rounded = Math.round(x * 10000) / 10000
  if (rounded !== expected)
    throw new Error(`Verification failed: expected x=${expected}, got x=${rounded}`)
}

// ── Learn content ─────────────────────────────────────────────────────────
const LEARN_HTML = `
<h2>Solving Linear Equations</h2>
<p>A <strong>linear equation</strong> has one unknown (usually <em>x</em>) and the highest power of that unknown is 1. Solving means finding the value of <em>x</em> that makes both sides equal.</p>

<h3>The Golden Rule</h3>
<p>Whatever you do to one side of the equation, you must do to the other side. This keeps the equation balanced.</p>

<h3>One-step equations</h3>
<div class="example">
  <p><strong>Example 1:</strong> Solve <code>x + 7 = 15</code></p>
  <p>Subtract 7 from both sides: <code>x = 15 − 7 = 8</code></p>
</div>
<div class="example">
  <p><strong>Example 2:</strong> Solve <code>4x = 28</code></p>
  <p>Divide both sides by 4: <code>x = 28 ÷ 4 = 7</code></p>
</div>

<h3>Two-step equations</h3>
<div class="example">
  <p><strong>Example 3:</strong> Solve <code>3x + 5 = 20</code></p>
  <p>Step 1 — subtract 5 from both sides: <code>3x = 15</code></p>
  <p>Step 2 — divide both sides by 3: <code>x = 5</code></p>
</div>

<h3>Unknowns on both sides</h3>
<div class="example">
  <p><strong>Example 4:</strong> Solve <code>5x + 2 = 2x + 14</code></p>
  <p>Step 1 — subtract 2x from both sides: <code>3x + 2 = 14</code></p>
  <p>Step 2 — subtract 2: <code>3x = 12</code></p>
  <p>Step 3 — divide by 3: <code>x = 4</code></p>
</div>

<h3>Check your answer</h3>
<p>Always substitute your answer back into the original equation to verify both sides are equal.</p>
`.trim()

// ── Practice game config ──────────────────────────────────────────────────
const PRACTICE_CONFIG = {
  title: 'Fill in the Blank',
  instructions: 'Type the value of x that makes each equation true.',
  questions: [
    { display: 'x + 9 = 14',   answer: '5'  },
    { display: '3x = 21',      answer: '7'  },
    { display: '2x + 4 = 14',  answer: '5'  },
    { display: 'x − 6 = 11',   answer: '17' },
    { display: '5x − 10 = 15', answer: '5'  },
  ],
}

// ── Quiz questions ─────────────────────────────────────────────────────────
// Format: { tier, question_text, question_type, correct_answer (string),
//           distractors[3], hint_1, hint_2, hint_3, explanation,
//           confidence_score, _verify: { lhsCoeff, lhsConst, rhsCoeff, rhsConst } }

const QUESTIONS = [
  // ── Sprout: one-step equations (add/subtract and simple multiply) ─────────
  {
    tier: 'sprout',
    question_text: 'Solve for x:  x + 8 = 13',
    question_type: 'maths_algebra',
    correct_answer: '5',
    distractors: ['4', '6', '21'],
    hint_1: 'You need to get x on its own.',
    hint_2: 'Subtract 8 from both sides.',
    hint_3: 'x = 13 − 8 = ?',
    explanation: 'Subtract 8 from both sides: x = 13 − 8 = 5.',
    confidence_score: 0.95,
    _verify: { lhsCoeff: 1, lhsConst: 8, rhsCoeff: 0, rhsConst: 13 },
  },
  {
    tier: 'sprout',
    question_text: 'Solve for x:  x − 4 = 10',
    question_type: 'maths_algebra',
    correct_answer: '14',
    distractors: ['6', '7', '40'],
    hint_1: 'You need to get x on its own.',
    hint_2: 'Add 4 to both sides.',
    hint_3: 'x = 10 + 4 = ?',
    explanation: 'Add 4 to both sides: x = 10 + 4 = 14.',
    confidence_score: 0.95,
    _verify: { lhsCoeff: 1, lhsConst: -4, rhsCoeff: 0, rhsConst: 10 },
  },
  {
    tier: 'sprout',
    question_text: 'Solve for x:  3x = 18',
    question_type: 'maths_algebra',
    correct_answer: '6',
    distractors: ['5', '7', '54'],
    hint_1: '3x means 3 multiplied by x.',
    hint_2: 'Divide both sides by 3.',
    hint_3: 'x = 18 ÷ 3 = ?',
    explanation: 'Divide both sides by 3: x = 18 ÷ 3 = 6.',
    confidence_score: 0.95,
    _verify: { lhsCoeff: 3, lhsConst: 0, rhsCoeff: 0, rhsConst: 18 },
  },
  {
    tier: 'sprout',
    question_text: 'Solve for x:  x + 12 = 20',
    question_type: 'maths_algebra',
    correct_answer: '8',
    distractors: ['7', '9', '32'],
    hint_1: 'You need to get x on its own.',
    hint_2: 'Subtract 12 from both sides.',
    hint_3: 'x = 20 − 12 = ?',
    explanation: 'Subtract 12 from both sides: x = 20 − 12 = 8.',
    confidence_score: 0.95,
    _verify: { lhsCoeff: 1, lhsConst: 12, rhsCoeff: 0, rhsConst: 20 },
  },
  {
    tier: 'sprout',
    question_text: 'Solve for x:  5x = 35',
    question_type: 'maths_algebra',
    correct_answer: '7',
    distractors: ['5', '8', '175'],
    hint_1: '5x means 5 multiplied by x.',
    hint_2: 'Divide both sides by 5.',
    hint_3: 'x = 35 ÷ 5 = ?',
    explanation: 'Divide both sides by 5: x = 35 ÷ 5 = 7.',
    confidence_score: 0.95,
    _verify: { lhsCoeff: 5, lhsConst: 0, rhsCoeff: 0, rhsConst: 35 },
  },

  // ── Explorer: two-step equations ──────────────────────────────────────────
  {
    tier: 'explorer',
    question_text: 'Solve for x:  2x + 3 = 11',
    question_type: 'maths_algebra',
    correct_answer: '4',
    distractors: ['3', '5', '7'],
    hint_1: 'There are two steps. Deal with the + 3 first.',
    hint_2: 'Subtract 3 from both sides to get 2x = 8.',
    hint_3: 'Now divide both sides by 2. x = 8 ÷ 2 = ?',
    explanation: 'Step 1: subtract 3 → 2x = 8. Step 2: divide by 2 → x = 4.',
    confidence_score: 0.92,
    _verify: { lhsCoeff: 2, lhsConst: 3, rhsCoeff: 0, rhsConst: 11 },
  },
  {
    tier: 'explorer',
    question_text: 'Solve for x:  3x − 5 = 16',
    question_type: 'maths_algebra',
    correct_answer: '7',
    distractors: ['5', '6', '8'],
    hint_1: 'There are two steps. Deal with the − 5 first.',
    hint_2: 'Add 5 to both sides to get 3x = 21.',
    hint_3: 'Now divide both sides by 3. x = 21 ÷ 3 = ?',
    explanation: 'Step 1: add 5 → 3x = 21. Step 2: divide by 3 → x = 7.',
    confidence_score: 0.92,
    _verify: { lhsCoeff: 3, lhsConst: -5, rhsCoeff: 0, rhsConst: 16 },
  },
  {
    tier: 'explorer',
    question_text: 'Solve for x:  4x + 1 = 25',
    question_type: 'maths_algebra',
    correct_answer: '6',
    distractors: ['5', '7', '4'],
    hint_1: 'There are two steps. Deal with the + 1 first.',
    hint_2: 'Subtract 1 from both sides to get 4x = 24.',
    hint_3: 'Now divide both sides by 4. x = 24 ÷ 4 = ?',
    explanation: 'Step 1: subtract 1 → 4x = 24. Step 2: divide by 4 → x = 6.',
    confidence_score: 0.92,
    _verify: { lhsCoeff: 4, lhsConst: 1, rhsCoeff: 0, rhsConst: 25 },
  },
  {
    tier: 'explorer',
    question_text: 'Solve for x:  5x − 7 = 23',
    question_type: 'maths_algebra',
    correct_answer: '6',
    distractors: ['5', '4', '7'],
    hint_1: 'There are two steps. Deal with the − 7 first.',
    hint_2: 'Add 7 to both sides to get 5x = 30.',
    hint_3: 'Now divide both sides by 5. x = 30 ÷ 5 = ?',
    explanation: 'Step 1: add 7 → 5x = 30. Step 2: divide by 5 → x = 6.',
    confidence_score: 0.92,
    _verify: { lhsCoeff: 5, lhsConst: -7, rhsCoeff: 0, rhsConst: 23 },
  },
  {
    tier: 'explorer',
    question_text: 'Solve for x:  2x + 9 = 21',
    question_type: 'maths_algebra',
    correct_answer: '6',
    distractors: ['5', '7', '15'],
    hint_1: 'There are two steps. Deal with the + 9 first.',
    hint_2: 'Subtract 9 from both sides to get 2x = 12.',
    hint_3: 'Now divide both sides by 2. x = 12 ÷ 2 = ?',
    explanation: 'Step 1: subtract 9 → 2x = 12. Step 2: divide by 2 → x = 6.',
    confidence_score: 0.92,
    _verify: { lhsCoeff: 2, lhsConst: 9, rhsCoeff: 0, rhsConst: 21 },
  },

  // ── Lightning: unknowns on both sides ────────────────────────────────────
  {
    tier: 'lightning',
    question_text: 'Solve for x:  5x + 2 = 2x + 14',
    question_type: 'maths_algebra',
    correct_answer: '4',
    distractors: ['3', '5', '6'],
    hint_1: 'Collect x terms on one side.',
    hint_2: 'Subtract 2x from both sides: 3x + 2 = 14.',
    hint_3: 'Subtract 2 → 3x = 12. Then divide by 3.',
    explanation: 'Subtract 2x: 3x + 2 = 14. Subtract 2: 3x = 12. Divide by 3: x = 4.',
    confidence_score: 0.90,
    _verify: { lhsCoeff: 5, lhsConst: 2, rhsCoeff: 2, rhsConst: 14 },
  },
  {
    tier: 'lightning',
    question_text: 'Solve for x:  6x − 3 = 4x + 9',
    question_type: 'maths_algebra',
    correct_answer: '6',
    distractors: ['5', '4', '7'],
    hint_1: 'Collect x terms on one side.',
    hint_2: 'Subtract 4x from both sides: 2x − 3 = 9.',
    hint_3: 'Add 3 → 2x = 12. Then divide by 2.',
    explanation: 'Subtract 4x: 2x − 3 = 9. Add 3: 2x = 12. Divide by 2: x = 6.',
    confidence_score: 0.90,
    _verify: { lhsCoeff: 6, lhsConst: -3, rhsCoeff: 4, rhsConst: 9 },
  },
  {
    tier: 'lightning',
    question_text: 'Solve for x:  7x + 1 = 3x + 17',
    question_type: 'maths_algebra',
    correct_answer: '4',
    distractors: ['3', '5', '2'],
    hint_1: 'Collect x terms on one side.',
    hint_2: 'Subtract 3x from both sides: 4x + 1 = 17.',
    hint_3: 'Subtract 1 → 4x = 16. Then divide by 4.',
    explanation: 'Subtract 3x: 4x + 1 = 17. Subtract 1: 4x = 16. Divide by 4: x = 4.',
    confidence_score: 0.90,
    _verify: { lhsCoeff: 7, lhsConst: 1, rhsCoeff: 3, rhsConst: 17 },
  },
  {
    tier: 'lightning',
    question_text: 'Solve for x:  8x − 6 = 5x + 9',
    question_type: 'maths_algebra',
    correct_answer: '5',
    distractors: ['4', '6', '3'],
    hint_1: 'Collect x terms on one side.',
    hint_2: 'Subtract 5x from both sides: 3x − 6 = 9.',
    hint_3: 'Add 6 → 3x = 15. Then divide by 3.',
    explanation: 'Subtract 5x: 3x − 6 = 9. Add 6: 3x = 15. Divide by 3: x = 5.',
    confidence_score: 0.90,
    _verify: { lhsCoeff: 8, lhsConst: -6, rhsCoeff: 5, rhsConst: 9 },
  },
  {
    tier: 'lightning',
    question_text: 'Solve for x:  4x + 10 = x + 22',
    question_type: 'maths_algebra',
    correct_answer: '4',
    distractors: ['3', '5', '8'],
    hint_1: 'Collect x terms on one side.',
    hint_2: 'Subtract x from both sides: 3x + 10 = 22.',
    hint_3: 'Subtract 10 → 3x = 12. Then divide by 3.',
    explanation: 'Subtract x: 3x + 10 = 22. Subtract 10: 3x = 12. Divide by 3: x = 4.',
    confidence_score: 0.90,
    _verify: { lhsCoeff: 4, lhsConst: 10, rhsCoeff: 1, rhsConst: 22 },
  },
]

// ── Verify all answers before any DB write ────────────────────────────────
console.log('Verifying all answers algebraically...')
let verifyFailed = false
for (const q of QUESTIONS) {
  try {
    assertAnswer(q._verify, Number(q.correct_answer))
    console.log(`  ✅ "${q.question_text}" → x = ${q.correct_answer}`)
  } catch (e) {
    console.error(`  ❌ "${q.question_text}": ${e.message}`)
    verifyFailed = true
  }
}
if (verifyFailed) {
  console.error('\nAbort: one or more answers failed verification. Fix before seeding.')
  process.exit(1)
}
console.log(`\nAll ${QUESTIONS.length} answers verified ✓\n`)

// ── Seed ──────────────────────────────────────────────────────────────────
async function main() {
  // 1. Find or create topic (idempotent by title + year group)
  console.log('Seeding topic...')
  let topic = await prisma.topic.findFirst({
    where: { title: 'Algebra: Solving Linear Equations', year_group_id: YEAR_7_ID },
  })
  if (!topic) {
    topic = await prisma.topic.create({
      data: {
        subject_id: MATHS_ID,
        year_group_id: YEAR_7_ID,
        zone_id: CRYSTAL_ZONE,
        title: 'Algebra: Solving Linear Equations',
        order_index: 1,
        is_published: true,
      },
    })
    console.log(`  Topic created: ${topic.id}`)
  } else {
    // Ensure it's published
    await prisma.topic.update({ where: { id: topic.id }, data: { is_published: true } })
    console.log(`  Topic already exists: ${topic.id}`)
  }

  // 2. Learn content — delete old + insert fresh (idempotent)
  console.log('Seeding learn_content...')
  await prisma.learnContent.deleteMany({ where: { topic_id: topic.id } })
  await prisma.learnContent.create({
    data: {
      topic_id: topic.id,
      body_html: LEARN_HTML,
      examples_json: {},
      status: 'published',
    },
  })
  console.log('  learn_content created ✓')

  // 3. Practice game — delete old + insert fresh
  console.log('Seeding practice_game...')
  await prisma.practiceGame.deleteMany({ where: { topic_id: topic.id } })
  await prisma.practiceGame.create({
    data: {
      topic_id: topic.id,
      game_type: 'fill_blank',
      config_json: PRACTICE_CONFIG,
    },
  })
  console.log('  practice_game created ✓')

  // 4. Quiz questions — delete old + insert fresh
  console.log('Seeding quiz_questions...')
  await prisma.quizQuestion.deleteMany({ where: { topic_id: topic.id } })
  for (const q of QUESTIONS) {
    const { _verify, ...data } = q
    await prisma.quizQuestion.create({
      data: {
        topic_id: topic.id,
        tier: data.tier,
        question_text: data.question_text,
        question_type: data.question_type,
        correct_answer: data.correct_answer,
        distractors: data.distractors,
        hint_1: data.hint_1,
        hint_2: data.hint_2,
        hint_3: data.hint_3,
        explanation: data.explanation,
        confidence_score: data.confidence_score,
        status: 'published',
      },
    })
  }
  console.log(`  ${QUESTIONS.length} quiz_questions created ✓`)

  // 5. Summary
  const counts = await prisma.quizQuestion.groupBy({
    by: ['tier'],
    where: { topic_id: topic.id, status: 'published' },
    _count: true,
  })
  console.log('\nPublished question counts:')
  for (const c of counts) console.log(`  ${c.tier}: ${c._count}`)

  console.log('\n✅ Phase 6 seed complete.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed error:', e.message)
  process.exit(1)
})
