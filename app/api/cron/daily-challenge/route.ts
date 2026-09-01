// POST /api/cron/daily-challenge
// Vercel Cron — runs daily at 23:00 UTC (midnight UK time in winter, 00:00 BST in summer).
// Seeds daily challenges for the next 2 days for all year groups.
// Uses ON CONFLICT DO NOTHING so re-runs are safe.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NEEDS_ITS_OWN_ANSWER_AREA } from '@/lib/points'

// The daily-challenge UI renders only plain single-answer multiple choice.
// It cannot present the question shapes the main quiz screen handles — typing,
// pairing, ordering, choosing between pictures — and "select all"-style prompts are
// multi-answer (no multi-select UI exists).
//
// This used to be its own copy of the list, which is how a picture-choice question
// nearly ended up here printing each picture's DESCRIPTION on a button, answer and
// all. One shared list now, in lib/points.ts.
const CANNOT_SHOW_HERE = [...NEEDS_ITS_OWN_ANSWER_AREA]

// Multi-answer ("select all/any") prompts can't be scored by the single-answer
// daily UI. Mirrors _MULTISELECT_PROMPT_RE in services/content-pipeline/pipeline.py
// (the pipeline gate now blocks new ones; this is the read-time safety net).
const MULTISELECT_PROMPT_RE = '(select|choose|tick|mark|pick)\\s+(all|every|each|any)|all that apply'

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
      // Check if already seeded
      const existing = await prisma.dailyChallenge.findFirst({
        where: { year_group_id: yg.id, date },
        select: { id: true },
      })
      if (existing) {
        results.push(`exists:${yg.label}:${date.toISOString().slice(0, 10)}`)
        continue
      }

      // Pick 3 random questions the daily UI can actually render: plain
      // single-answer multiple choice (exactly 3 distractors), excluding the
      // multi-part types QuizShell special-cases and "select all"-style
      // multi-answer prompts. distractors is guarded with jsonb_typeof because
      // a few legacy rows store it as a non-array scalar.
      const questions = await prisma.$queryRaw<{ id: string }[]>`
        SELECT q.id
        FROM quiz_questions q
        JOIN topics t ON t.id = q.topic_id
        WHERE q.status = 'published'
          AND t.year_group_id = ${yg.id}::uuid
          AND q.question_type NOT IN (${Prisma.join(CANNOT_SHOW_HERE)})
          AND (CASE WHEN jsonb_typeof(q.distractors) = 'array'
                    THEN jsonb_array_length(q.distractors) ELSE 0 END) = 3
          AND q.question_text !~* ${MULTISELECT_PROMPT_RE}
        ORDER BY random()
        LIMIT 3`

      if (questions.length < 3) {
        results.push(`skip:${yg.label}:${date.toISOString().slice(0, 10)} (only ${questions.length} renderable questions)`)
        continue
      }

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
