// PATCH /api/admin/questions/[questionId]/status
// Admin: reinstate a flagged question back to published, or delete it permanently.

import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: { questionId: string } },
) {
  const denied = await requireAdminApi()
  if (denied) return denied

  const { action } = await req.json() as { action: 'reinstate' | 'delete' }
  if (!['reinstate', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (action === 'delete') {
    await prisma.quizQuestion.delete({ where: { id: params.questionId } })
    return NextResponse.json({ ok: true })
  }

  // reinstate → back to published
  await prisma.quizQuestion.update({
    where: { id: params.questionId },
    data: { status: 'published' },
  })
  return NextResponse.json({ ok: true })
}
