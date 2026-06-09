export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole, canActAsParent } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

// GET /api/vault/parent/requests
// Parent reads all reward requests from their linked children.
// Optional ?status=pending|approved|... filter.
export async function GET(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getUserRole(user)
  if (!canActAsParent(role)) {
    return NextResponse.json({ error: 'Only parent accounts can view reward requests' }, { status: 403 })
  }

  const parentProfile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!parentProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')

  const requests = await prisma.rewardRequest.findMany({
    where: {
      parent_profile_id: parentProfile.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      status: true,
      milestone_band: true,
      child_message: true,
      parent_response_note: true,
      reward_type: true,
      reward_label: true,
      credits_used: true,
      created_at: true,
      responded_at: true,
      xp_at_request: true,
      topics_at_request: true,
      badges_at_request: true,
      streak_at_request: true,
      child: { select: { id: true, display_name: true } },
    },
  })

  return NextResponse.json(requests)
}
