import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { checkAndUpdateMilestone } from '@/lib/vault/status'

// POST /api/vault/check-milestone
// Triggers a milestone check for the calling child.
// Called non-blockingly after quiz submit; may also be called directly from the child UI.
export async function POST() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getUserRole(user)
  if (role !== 'child') {
    return NextResponse.json({ error: 'Only child accounts can trigger milestone checks' }, { status: 403 })
  }

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const result = await checkAndUpdateMilestone(profile.id)
  return NextResponse.json(result)
}
