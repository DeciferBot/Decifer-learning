// GET|POST /api/cron/calibrate-difficulty
// Vercel Cron — runs nightly at 01:00 UTC (before anomaly-detect at 02:00).
// Also callable from the admin monitoring page (same CRON_SECRET header).
//
// Closes the IRT calibration loop: aggregates first-attempt correctness per
// PUBLISHED question, computes a Rasch difficulty (lib/irt.ts), and writes it
// back to quiz_questions.difficulty_b. Adaptive selection then pitches items at
// each child's estimated ability instead of relying solely on editorial tier.
//
// SAFETY: read-only over response data + a narrow UPDATE of three calibration
// columns. It NEVER changes a question's tier, status, or content — mis-tier
// findings are reported for human/admin review, not auto-applied (editorial
// gates in CLAUDE.md §10 are not bypassed).

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { difficultyFromResponses, recommendTier, MIN_CALIBRATION_N } from '@/lib/irt'
import { alertPipelineFailure } from '@/lib/pipeline-alert'

interface AggRow {
  question_id: string
  tier: string
  correct: number
  total: number
}

async function handler(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // First-attempt correctness per (question, child): the chronologically-first
  // answer a child gave to each published question. Mirrors the §9 anomaly
  // definition of "first-attempt answers" so calibration and flagging agree.
  let rows: AggRow[]
  try {
    rows = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
      WITH first_answers AS (
        SELECT DISTINCT ON (qa.question_id, qat.profile_id)
               qa.question_id,
               qa.was_correct
        FROM quiz_answers qa
        JOIN quiz_attempts qat ON qat.id = qa.attempt_id
        ORDER BY qa.question_id, qat.profile_id, qat.created_at ASC
      )
      SELECT q.id::text                                   AS question_id,
             q.tier::text                                 AS tier,
             COUNT(*) FILTER (WHERE fa.was_correct)::int  AS correct,
             COUNT(*)::int                                AS total
      FROM quiz_questions q
      JOIN first_answers fa ON fa.question_id = q.id
      WHERE q.status = 'published'
      GROUP BY q.id, q.tier
      HAVING COUNT(*) >= ${MIN_CALIBRATION_N}
    `)
  } catch (err) {
    // Most likely cause: the calibration columns/migration haven't been deployed.
    console.error('[calibrate-difficulty] aggregation failed', err)
    await alertPipelineFailure({
      job: 'calibrate-difficulty',
      reason: 'Calibration aggregation query failed',
      context: { hint: 'Verify the add_irt_calibration columns exist', detail: String(err) },
    })
    return NextResponse.json(
      { error: 'aggregation_failed', hint: 'Deploy migration 20260615120000_add_irt_calibration', detail: String(err) },
      { status: 500 },
    )
  }

  let calibrated = 0
  const retierSuggestions: Array<{ question_id: string; from: string; to: string; b: number }> = []

  // Compute b in TS via the unit-tested lib/irt fn (single source of truth for
  // the smoothing + clamp), then write back. Pilot-scale calibration sets are
  // small (only items with ≥20 responses), so per-row updates in one txn are fine.
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const b = difficultyFromResponses({ correct: Number(r.correct), total: Number(r.total) })
      if (b == null) continue
      await tx.$executeRaw(Prisma.sql`
        UPDATE quiz_questions
        SET difficulty_b = ${b}, calibration_n = ${Number(r.total)}, calibrated_at = now()
        WHERE id = ${r.question_id}::uuid
      `)
      calibrated++
      const suggested = recommendTier(b)
      if (suggested !== r.tier) {
        retierSuggestions.push({ question_id: r.question_id, from: r.tier, to: suggested, b: Number(b.toFixed(3)) })
      }
    }
  })

  const summary = {
    items_evaluated: rows.length,
    items_calibrated: calibrated,
    retier_suggestions: retierSuggestions.length,
    // Cap the detail payload so the log row stays small; full list derivable on demand.
    sample_retiers: retierSuggestions.slice(0, 20),
  }

  // Persist for the admin monitoring page (same table as the other crons).
  try {
    await prisma.$executeRaw`
      INSERT INTO cron_run_log (job, result)
      VALUES ('calibrate-difficulty', ${JSON.stringify(summary)}::jsonb)
    `
  } catch (err) {
    console.error('[calibrate-difficulty] cron_run_log insert failed (non-fatal)', err)
  }

  console.log('[calibrate-difficulty] run complete', { ...summary, sample_retiers: summary.sample_retiers.length })
  return NextResponse.json(summary)
}

export const GET = handler
export const POST = handler
