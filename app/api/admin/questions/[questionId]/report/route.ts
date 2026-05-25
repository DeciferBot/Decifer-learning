// POST /api/admin/questions/[questionId]/report — child submits a "Report a problem"
// PATCH /api/admin/questions/[questionId]/report — admin reviews/dismisses a report

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

type Params = { params: { questionId: string } }

export async function POST(req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.profile.findUnique({
    where:  { user_id: user.id },
    select: { id: true, role: true },
  })
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { reason?: string }
  const reason = (body.reason ?? '').trim()
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required', code: 'MISSING_REASON' }, { status: 422 })
  }
  if (reason.length > 280) {
    return NextResponse.json({ error: 'Reason must be 280 characters or fewer', code: 'REASON_TOO_LONG' }, { status: 422 })
  }

  // Verify question exists
  const q = await prisma.quizQuestion.findUnique({
    where:  { id: params.questionId },
    select: { id: true },
  })
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  // Upsert — one open report per child per question
  const existing = await prisma.questionReport.findFirst({
    where: { question_id: params.questionId, profile_id: profile.id, status: 'open' },
  })
  if (existing) {
    return NextResponse.json({ ok: true, alreadyReported: true })
  }

  await prisma.questionReport.create({
    data: {
      question_id: params.questionId,
      profile_id:  profile.id,
      reason,
      status:      'open',
    },
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getUserRole(user) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { reportId: string; action: 'reviewed' | 'dismissed' | 'flag_question' }
  if (!body.reportId || !['reviewed', 'dismissed', 'flag_question'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.questionReport.update({
      where: { id: body.reportId },
      data:  { status: body.action === 'flag_question' ? 'reviewed' : body.action },
    })

    if (body.action === 'flag_question') {
      await tx.quizQuestion.update({
        where: { id: params.questionId },
        data:  { status: 'flagged' },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
