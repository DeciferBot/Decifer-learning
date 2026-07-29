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
import { difficultyFromResponses, recommendTier, MIN_CALIBRATION_N, MIN_PRIOR_N } from '@/lib/irt'
import { alertPipelineFailure } from '@/lib/pipeline-alert'

interface AggRow {
  question_id: string
  tier: string
  correct: number
  total: number
}

interface PriorAggRow {
  question_type: string
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

  // ── Pooled group priors ───────────────────────────────────────────────────
  //
  // Item-level calibration above needs 20 first-attempt responses on a single
  // question. With 6,971 published questions against roughly a thousand answers
  // in total, that has never once fired. Pooling the same responses by
  // (question_type, tier) puts enough evidence in each cell to be worth using,
  // and every item in the group inherits the result until it earns its own.
  //
  // Same first-attempt definition as above, so the two agree.
  let priorsWritten = 0
  const priorRows: Array<{ key: string; b: number; n: number }> = []
  try {
    const agg = await prisma.$queryRaw<PriorAggRow[]>(Prisma.sql`
      WITH first_answers AS (
        SELECT DISTINCT ON (qa.question_id, qat.profile_id)
               qa.question_id,
               qa.was_correct
        FROM quiz_answers qa
        JOIN quiz_attempts qat ON qat.id = qa.attempt_id
        ORDER BY qa.question_id, qat.profile_id, qat.created_at ASC
      ),
      typed AS (
        SELECT q.question_type::text AS question_type,
               q.tier::text          AS tier,
               fa.was_correct
        FROM quiz_questions q
        JOIN first_answers fa ON fa.question_id = q.id
        WHERE q.status = 'published'
      )
      SELECT question_type,
             tier,
             COUNT(*) FILTER (WHERE was_correct)::int AS correct,
             COUNT(*)::int                            AS total
      FROM typed
      GROUP BY question_type, tier
      UNION ALL
      -- '*' is the coarser tier-only fallback for types with too little data.
      SELECT '*' AS question_type,
             tier,
             COUNT(*) FILTER (WHERE was_correct)::int AS correct,
             COUNT(*)::int                            AS total
      FROM typed
      GROUP BY tier
    `)

    for (const r of agg) {
      const b = difficultyFromResponses(
        { correct: Number(r.correct), total: Number(r.total) },
        MIN_PRIOR_N,
      )
      if (b == null) continue
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO question_difficulty_priors (question_type, tier, difficulty_b, sample_n, updated_at)
        VALUES (${r.question_type}, ${r.tier}, ${b}, ${Number(r.total)}, now())
        ON CONFLICT (question_type, tier)
        DO UPDATE SET difficulty_b = EXCLUDED.difficulty_b,
                      sample_n     = EXCLUDED.sample_n,
                      updated_at   = now()
      `)
      priorsWritten++
      priorRows.push({ key: `${r.question_type}/${r.tier}`, b: Number(b.toFixed(3)), n: Number(r.total) })
    }
  } catch (err) {
    // Non-fatal: item calibration above has already been written, and selection
    // falls back to tier order when no prior exists.
    console.error('[calibrate-difficulty] group priors failed (non-fatal)', err)
  }

  const summary = {
    items_evaluated: rows.length,
    items_calibrated: calibrated,
    retier_suggestions: retierSuggestions.length,
    // Cap the detail payload so the log row stays small; full list derivable on demand.
    sample_retiers: retierSuggestions.slice(0, 20),
    priors_written: priorsWritten,
    sample_priors: priorRows.slice(0, 20),
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

  console.log('[calibrate-difficulty] run complete', {
    ...summary,
    sample_retiers: summary.sample_retiers.length,
    sample_priors: summary.sample_priors.length,
  })
  return NextResponse.json(summary)
}

export const GET = handler
export const POST = handler
