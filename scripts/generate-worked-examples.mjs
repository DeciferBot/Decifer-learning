/**
 * generate-worked-examples.mjs
 *
 * Generates step-by-step worked examples for all published quiz questions
 * that don't yet have one. Uses the Anthropic API directly (no SDK needed).
 *
 * Run: node --env-file=.env.local scripts/generate-worked-examples.mjs
 * Dry run: node --env-file=.env.local scripts/generate-worked-examples.mjs --dry-run
 *
 * Safe to re-run: skips questions that already have worked_example set.
 *
 * Learning science basis: Barbieri et al. 2023, g=0.48 (Educational Psychology Review)
 */

import { PrismaClient } from '@prisma/client'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 5
const DELAY_MS = 600
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set. Run with --env-file=.env.local')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const YEAR_LABEL = {
  'year-2': 'Year 2 (age 6-7)',
  'year-3': 'Year 3 (age 7-8)',
  'year-6': 'Year 6 (age 10-11)',
  'year-7': 'Year 7 (age 11-12)',
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text?.trim() ?? ''
}

async function generateWorkedExample(questionText, questionType, correctAnswer, yearLabel, subjectName) {
  const prompt = `You are writing a worked example for a ${yearLabel} ${subjectName} quiz question.

ACTUAL QUESTION (do NOT solve this — use DIFFERENT numbers/content):
${questionText}
Correct answer: ${correctAnswer}
Question type: ${questionType}

Write a SHORT worked example (3–5 numbered steps) that:
1. Uses a SIMILAR but COMPLETELY DIFFERENT problem (different numbers, different words)
2. Shows the METHOD step-by-step in plain language a ${yearLabel} child can follow
3. Never reveals or hints at the answer to the actual question above
4. Is encouraging and clear — no jargon
5. Ends with the answer to YOUR example problem

Format: plain numbered steps, no markdown, no headers.
Start with "Example: ..." then number your steps 1, 2, 3...
Keep it under 120 words total.`

  return callClaude(prompt)
}

async function main() {
  console.log(`\n🔬 Worked Example Generator — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  const questions = await prisma.quizQuestion.findMany({
    where: { status: 'published', worked_example: null },
    include: {
      topic: {
        include: {
          year_group: { select: { label: true } },
          subject: { select: { name: true } },
        },
      },
    },
    orderBy: [{ topic: { year_group: { label: 'asc' } } }, { created_at: 'asc' }],
  })

  console.log(`Found ${questions.length} published questions without worked examples.\n`)

  if (questions.length === 0) {
    console.log('✅ Nothing to do.')
    return
  }

  let success = 0
  let failed = 0

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(questions.length / BATCH_SIZE)
    const pct = Math.round((i / questions.length) * 100)

    process.stdout.write(`\rBatch ${batchNum}/${totalBatches} (${pct}% done)…`)

    await Promise.all(
      batch.map(async (q) => {
        try {
          const yearLabel = YEAR_LABEL[q.topic.year_group.label] ?? q.topic.year_group.label
          const example = await generateWorkedExample(
            q.question_text,
            q.question_type,
            q.correct_answer,
            yearLabel,
            q.topic.subject.name,
          )

          if (!example || example.length < 20) {
            process.stdout.write(`\n  ⚠ ${q.id}: short response — skipping\n`)
            failed++
            return
          }

          if (DRY_RUN) {
            process.stdout.write(`\n  [DRY] ${q.question_type}: ${example.slice(0, 80)}…\n`)
          } else {
            await prisma.quizQuestion.update({
              where: { id: q.id },
              data: { worked_example: example },
            })
          }
          success++
        } catch (err) {
          process.stdout.write(`\n  ✗ ${q.id}: ${err.message?.slice(0, 80)}\n`)
          failed++
        }
      }),
    )

    if (i + BATCH_SIZE < questions.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\n\n${'─'.repeat(50)}`)
  console.log(`✅ Success: ${success}`)
  console.log(`❌ Failed:  ${failed}`)
  console.log(`Total:     ${questions.length}`)
  if (!DRY_RUN && success > 0) console.log(`\nDone — worked_example written to ${success} rows.`)
}

main()
  .catch((err) => { console.error('\nFATAL:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
