import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { getVaultStatus } from '@/lib/vault/status'

// GET /api/vault/status
// Child reads their own vault status.
// Parent may read a linked child's status by passing ?childId=<profileId>.
export async function GET(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getUserRole(user)
  const { searchParams } = new URL(req.url)
  const childIdParam = searchParams.get('childId')

  const callerProfile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true, role: true },
  })
  if (!callerProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let targetProfileId: string

  if (childIdParam) {
    // Parent reading a linked child's status
    if (role !== 'parent' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (role === 'parent') {
      const link = await prisma.familyLink.findFirst({
        where: {
          parent_user_id: user.id,
          child: { id: childIdParam },
        },
        select: { id: true },
      })
      if (!link) return NextResponse.json({ error: 'Child not linked to this parent' }, { status: 403 })
    }
    targetProfileId = childIdParam
  } else {
    // Child reading own status
    if (role !== 'child') {
      return NextResponse.json({ error: 'Provide ?childId= to read a child\'s vault status' }, { status: 400 })
    }
    targetProfileId = callerProfile.id
  }

  const status = await getVaultStatus(targetProfileId)
  return NextResponse.json(status)
}
