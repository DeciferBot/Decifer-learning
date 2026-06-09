import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { canActAsParent } from '@/lib/auth/roles'

// GET /api/exam/assignments?childId=<id>
// Returns all exam assignments created by this parent, with attempt info.
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parentProfile = await getCurrentProfile(supabase, user.id)
  if (!parentProfile || !canActAsParent(parentProfile.role)) {
    return NextResponse.json({ error: 'Parent account required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const childId = searchParams.get('childId')

  const assignments = await prisma.examAssignment.findMany({
    where: {
      parent_profile_id: parentProfile.id,
      ...(childId ? { child_profile_id: childId } : {}),
    },
    orderBy: { created_at: 'desc' },
    include: {
      subject: { select: { name: true, colour_token: true } },
      attempts: {
        select: { id: true, score: true, status: true, completed_at: true },
        orderBy: { started_at: 'desc' },
        take: 1,
      },
    },
  })

  return NextResponse.json({ assignments })
}
