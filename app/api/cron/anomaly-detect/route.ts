// POST /api/cron/anomaly-detect
// Vercel Cron — runs nightly at 02:00 UTC.
// Also callable from the admin monitoring page (same CRON_SECRET header).
// Flags published questions that fail quality checks so children never see them again.
// Five rules (matching CLAUDE.md §12):
//   1. Error rate > 60% with ≥ 20 first-attempt answers
//   2. Hint-3 usage rate > 50% with ≥ 15 attempts
//   3. Question references a visual ("this graph", "the diagram", etc.) but has no foundation_images
//   4. Any two hints are identical (broken hint progression)
//   5. Non-Maths question is a pure arithmetic word problem (subject mismatch)
// After flagging, staged questions that pass every gate are auto-promoted to published.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { alertPipelineFailure } from '@/lib/pipeline-alert'

// Vercel Cron invokes the path with a GET request (and an Authorization: Bearer <CRON_SECRET>
// header when CRON_SECRET is configured). POST stays exported for manual/local invocation.
async function handler(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServerClient()

  const { data: highError,       error: e1 } = await supabase.rpc('flag_high_error_rate_questions')
  const { data: highHint,        error: e2 } = await supabase.rpc('flag_high_hint_rate_questions')
  const { data: missingVisual,   error: e3 } = await supabase.rpc('flag_missing_visual_questions')
  const { data: hintDup,         error: e4 } = await supabase.rpc('flag_hint_duplication_questions')
  const { data: subjectMismatch, error: e5 } = await supabase.rpc('flag_subject_mismatch_questions')
  // Auto-publish: staged questions passing every gate (score, hints, grounding/verification, visuals)
  const { data: promoted,        error: e6 } = await supabase.rpc('promote_qualified_staged_questions')

  const rpcErrors = { e1, e2, e3, e4, e5, e6 }
  const hasErrors = e1 || e2 || e3 || e4 || e5 || e6
  if (hasErrors) {
    console.error('[anomaly-detect] RPC errors (partial results will still be logged)', rpcErrors)
    await alertPipelineFailure({
      job: 'anomaly-detect',
      reason: 'One or more anomaly-detection RPCs failed',
      context: Object.fromEntries(
        Object.entries(rpcErrors).filter(([, v]) => v).map(([k, v]) => [k, String(v?.message ?? v)]),
      ),
    })
  }

  const summary = {
    flagged_high_error:       highError       ?? 0,
    flagged_high_hint:        highHint        ?? 0,
    flagged_missing_visual:   missingVisual   ?? 0,
    flagged_hint_duplication: hintDup         ?? 0,
    flagged_subject_mismatch: subjectMismatch ?? 0,
    promoted_staged:          promoted        ?? 0,
    total: (highError ?? 0) + (highHint ?? 0) + (missingVisual ?? 0) + (hintDup ?? 0) + (subjectMismatch ?? 0),
    ...(hasErrors ? { errors: rpcErrors } : {}),
  }

  // Persist so the admin monitoring page can show last-run results
  await prisma.$executeRaw`
    INSERT INTO cron_run_log (job, result)
    VALUES ('anomaly-detect', ${JSON.stringify(summary)}::jsonb)
  `

  console.log('[anomaly-detect] run complete', summary)
  return NextResponse.json(summary)
}

export const GET = handler
export const POST = handler
