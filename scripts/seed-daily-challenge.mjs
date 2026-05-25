/**
 * Seed today's daily challenge for all year groups.
 * Picks 3 random published questions per year group.
 * Safe to re-run — upserts on (date, year_group_id).
 *
 * Usage:
 *   node scripts/seed-daily-challenge.mjs            # seed today
 *   node scripts/seed-daily-challenge.mjs --days 7   # seed next 7 days
 *   node scripts/seed-daily-challenge.mjs --flare     # mark as flare challenge
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const args      = process.argv.slice(2)
const isFlare   = args.includes('--flare')
const daysFlag  = args.indexOf('--days')
const numDays   = daysFlag >= 0 ? parseInt(args[daysFlag + 1] ?? '1', 10) : 1

async function seedDay(date, isFlare) {
  const yearGroups = await prisma.yearGroup.findMany({ select: { id: true, label: true } })

  for (const yg of yearGroups) {
    // Pick 3 random published questions for this year group
    const count = await prisma.quizQuestion.count({
      where: {
        status:    'published',
        topic: { year_group_id: yg.id },
      },
    })

    if (count < 3) {
      console.log(`  ⚠  ${yg.label}: only ${count} published questions — skipping`)
      continue
    }

    // Random offset-based selection
    const offset = Math.floor(Math.random() * Math.max(1, count - 3))
    const questions = await prisma.quizQuestion.findMany({
      where: {
        status:    'published',
        topic: { year_group_id: yg.id },
      },
      select: { id: true },
      skip:   offset,
      take:   3,
      orderBy: { created_at: 'asc' },
    })

    const questionIds = questions.map((q) => q.id)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)

    await prisma.dailyChallenge.upsert({
      where: {
        date_year_group_id: {
          date:          d,
          year_group_id: yg.id,
        },
      },
      create: {
        date:          d,
        year_group_id: yg.id,
        question_ids:  questionIds,
        is_flare:      isFlare,
      },
      update: {
        question_ids: questionIds,
        is_flare:     isFlare,
      },
    })

    const dateStr = d.toISOString().slice(0, 10)
    console.log(`  ✓  ${yg.label} ${dateStr}${isFlare ? ' ⚡ FLARE' : ''}: ${questionIds.length} questions`)
  }
}

async function main() {
  console.log(`\n── Daily Challenge Seeder ──\n`)
  for (let i = 0; i < numDays; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    await seedDay(d, isFlare && i === 0) // flare only on first day
  }
  console.log(`\nDone — seeded ${numDays} day(s).\n`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
