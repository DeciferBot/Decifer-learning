// POST /api/cron/daily-challenge
// Vercel Cron — runs daily at 23:00 UTC (midnight UK time in winter, 00:00 BST in summer).
// Seeds daily challenges for the next 2 days for all year groups.
// Uses ON CONFLICT DO NOTHING so re-runs are safe.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Vercel Cron invokes the path with a GET request (and an Authorization: Bearer <CRON_SECRET>
// header when CRON_SECRET is configured). POST stays exported for manual/local invocation.
async function handler(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yearGroups = await prisma.yearGroup.findMany({ select: { id: true, label: true } })
  const results: string[] = []

  for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + dayOffset)
    date.setUTCHours(0, 0, 0, 0)

    for (const yg of yearGroups) {
      const count = await prisma.quizQuestion.count({
        where: { status: 'published', topic: { year_group_id: yg.id } },
      })

      if (count < 3) {
        results.push(`skip:${yg.label}:${date.toISOString().slice(0, 10)} (only ${count} questions)`)
        continue
      }

      // Check if already seeded
      const existing = await prisma.dailyChallenge.findFirst({
        where: { year_group_id: yg.id, date },
        select: { id: true },
      })
      if (existing) {
        results.push(`exists:${yg.label}:${date.toISOString().slice(0, 10)}`)
        continue
      }

      const offset = Math.floor(Math.random() * Math.max(1, count - 3))
      const questions = await prisma.quizQuestion.findMany({
        where: { status: 'published', topic: { year_group_id: yg.id } },
        select: { id: true },
        skip: offset,
        take: 3,
        orderBy: { created_at: 'asc' },
      })

      await prisma.dailyChallenge.create({
        data: {
          date,
          year_group_id: yg.id,
          question_ids: questions.map((q) => q.id),
          is_flare: false,
        },
      })

      results.push(`seeded:${yg.label}:${date.toISOString().slice(0, 10)}`)
    }
  }

  return NextResponse.json({ ok: true, results })
}

export const GET = handler
export const POST = handler
