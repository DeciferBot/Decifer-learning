// GET /api/vault/suggestions/[childId]
// Returns up to 3 smart reward suggestions for a child, based on PLI signals.
// Parent-only. Never exposes price_pence.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { getRewardSuggestions } from '@/lib/vault/suggestions'

export async function GET(
  _req: Request,
  { params }: { params: { childId: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (getUserRole(user) !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { childId } = params

  // Verify parent→child link (childId is profile.id)
  const link = await prisma.familyLink.findFirst({
    where: { parent_user_id: user.id, child: { id: childId } },
  })
  if (!link) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const suggestions = await getRewardSuggestions(childId)
  return NextResponse.json({ suggestions })
}
