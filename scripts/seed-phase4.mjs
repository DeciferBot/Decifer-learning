/**
 * Phase 4 seed — learn_content and practice_games for Multiplication Tables.
 * Idempotent: re-running updates rather than duplicates.
 *
 * Run: DATABASE_URL='...' DIRECT_URL='...' node scripts/seed-phase4.mjs
 */

import { PrismaClient } from '@prisma/client'

const TOPIC_ID = 'd8089833-9cb5-4714-aa4b-01713c072a7e' // Multiplication Tables, Year 3 Maths

const prisma = new PrismaClient()

const LEARN_HTML = `
<h2>What are Multiplication Tables?</h2>
<p>Multiplication is a quick way to count <strong>equal groups</strong>. Instead of adding 4 + 4 + 4, you can write <strong>3 × 4 = 12</strong> and get the answer straight away!</p>

<h3>The × symbol means "groups of"</h3>
<p><strong>3 × 4</strong> means <em>3 groups of 4</em>.</p>
<p>Think of 3 plates, each with 4 biscuits — that's 12 biscuits altogether.</p>

<h3>Times tables to know for Year 3</h3>
<ul>
  <li>The <strong>2 times table</strong> — count in 2s: 2, 4, 6, 8, 10, 12…</li>
  <li>The <strong>3 times table</strong> — count in 3s: 3, 6, 9, 12, 15…</li>
  <li>The <strong>4 times table</strong> — double the 2 times table!</li>
  <li>The <strong>5 times table</strong> — count in 5s: 5, 10, 15, 20, 25…</li>
  <li>The <strong>8 times table</strong> — double the 4 times table!</li>
  <li>The <strong>10 times table</strong> — just add a zero: 10, 20, 30, 40…</li>
</ul>

<h3>Multiplication works both ways!</h3>
<p><strong>4 × 8 = 32</strong> and <strong>8 × 4 = 32</strong> give the same answer. You can always flip a multiplication around. This means there are only half as many facts to memorise!</p>

<h3>How to work out a tricky one</h3>
<p>To work out <strong>7 × 6</strong>:</p>
<ol>
  <li>Think of it as 7 groups of 6.</li>
  <li>Count up in 6s: 6, 12, 18, 24, 30, 36, 42.</li>
  <li>The answer is <strong>42</strong>!</li>
</ol>

<h3>Top tip</h3>
<p>Practise a little every day and you'll soon know them all by heart. Tables that feel hard today will feel easy next week!</p>
`.trim()

const PRACTICE_CONFIG = {
  title: 'Fill in the Blank',
  instructions: 'Type the missing number. Press Enter or tap Check to submit.',
  questions: [
    { display: '2 × 3 = ___', answer: '6' },
    { display: '5 × 4 = ___', answer: '20' },
    { display: '3 × 7 = ___', answer: '21' },
    { display: '6 × 4 = ___', answer: '24' },
    { display: '5 × 8 = ___', answer: '40' },
    { display: '9 × 3 = ___', answer: '27' },
    { display: '7 × 6 = ___', answer: '42' },
    { display: '8 × 4 = ___', answer: '32' },
    { display: '10 × 7 = ___', answer: '70' },
    { display: '6 × 6 = ___', answer: '36' },
  ],
}

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Phase 4 seed — learn_content + practice_games')
  console.log('══════════════════════════════════════════════\n')

  const topic = await prisma.topic.findUnique({ where: { id: TOPIC_ID } })
  if (!topic) throw new Error(`Topic ${TOPIC_ID} not found — run Phase 3 seed first`)
  console.log(`  Topic: "${topic.title}"`)

  // Upsert learn_content
  const existing = await prisma.learnContent.findFirst({ where: { topic_id: TOPIC_ID } })
  if (existing) {
    await prisma.learnContent.update({
      where: { id: existing.id },
      data: { body_html: LEARN_HTML, status: 'published' },
    })
    console.log('✅ learn_content updated (status=published)')
  } else {
    await prisma.learnContent.create({
      data: { topic_id: TOPIC_ID, body_html: LEARN_HTML, status: 'published' },
    })
    console.log('✅ learn_content created (status=published)')
  }

  // Upsert practice_game
  const existingGame = await prisma.practiceGame.findFirst({ where: { topic_id: TOPIC_ID } })
  if (existingGame) {
    await prisma.practiceGame.update({
      where: { id: existingGame.id },
      data: { game_type: 'fill_blank', config_json: PRACTICE_CONFIG },
    })
    console.log('✅ practice_game updated')
  } else {
    await prisma.practiceGame.create({
      data: { topic_id: TOPIC_ID, game_type: 'fill_blank', config_json: PRACTICE_CONFIG },
    })
    console.log('✅ practice_game created')
  }

  // Mark topic as published so RLS allows authenticated reads
  await prisma.topic.update({
    where: { id: TOPIC_ID },
    data: { is_published: true },
  })
  console.log('✅ topics.is_published = true')

  console.log('\nPhase 4 seed complete.\n')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e.message)
  process.exit(1)
})
