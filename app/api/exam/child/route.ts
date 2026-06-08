import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'

// GET /api/exam/child
// Returns exams assigned to the logged-in child that are active and within window.
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile || profile.role !== 'child') {
    return NextResponse.json({ error: 'Child account required' }, { status: 403 })
  }

  const now = new Date()

  const assignments = await prisma.examAssignment.findMany({
    where: {
      child_profile_id: profile.id,
      status: 'active',
      OR: [
        { available_from: null },
        { available_from: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { available_until: null },
            { available_until: { gte: now } },
          ],
        },
      ],
    },
    orderBy: { created_at: 'desc' },
    include: {
      subject: { select: { name: true, colour_token: true, slug: true } },
      attempts: {
        where: { profile_id: profile.id },
        select: { id: true, score: true, status: true, completed_at: true },
        orderBy: { started_at: 'desc' },
        take: 1,
      },
    },
  })

  return NextResponse.json({ assignments })
}
