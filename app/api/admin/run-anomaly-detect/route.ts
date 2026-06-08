// POST /api/admin/run-anomaly-detect
// Admin-only proxy that calls the anomaly detection logic with the server-side CRON_SECRET.
// The browser never sees the secret.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const denied = await requireAdminApi()
  if (denied) return denied

  const supabase = createSupabaseServerClient()

  const { data: highError,      error: e1 } = await supabase.rpc('flag_high_error_rate_questions')
  const { data: highHint,       error: e2 } = await supabase.rpc('flag_high_hint_rate_questions')
  const { data: missingVisual,  error: e3 } = await supabase.rpc('flag_missing_visual_questions')

  if (e1 || e2 || e3) {
    return NextResponse.json({ error: 'Partial failure' }, { status: 500 })
  }

  const summary = {
    flagged_high_error:     highError     ?? 0,
    flagged_high_hint:      highHint      ?? 0,
    flagged_missing_visual: missingVisual ?? 0,
    total: (highError ?? 0) + (highHint ?? 0) + (missingVisual ?? 0),
  }

  await prisma.$executeRaw`
    INSERT INTO cron_run_log (job, result)
    VALUES ('anomaly-detect', ${JSON.stringify(summary)}::jsonb)
  `

  return NextResponse.json(summary)
}
