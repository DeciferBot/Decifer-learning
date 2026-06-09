import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole, canActAsParent } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { getOrCreateParentSettings, updateParentSettings } from '@/lib/vault/settings'
import type { DeliveryAddress } from '@/lib/vault/settings'

type Params = { params: { childId: string } }

// Verify the calling parent has a family_link to the given child profile.
async function verifyParentChildLink(parentUserId: string, childProfileId: string) {
  const link = await prisma.familyLink.findFirst({
    where: {
      parent_user_id: parentUserId,
      child: { id: childProfileId },
    },
    select: { id: true },
  })
  return link !== null
}

// GET /api/vault/parent/settings/[childId]
export async function GET(_req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canActAsParent(getUserRole(user))) {
    return NextResponse.json({ error: 'Only parent accounts can read vault settings' }, { status: 403 })
  }

  const parentProfile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!parentProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const linked = await verifyParentChildLink(user.id, params.childId)
  if (!linked) return NextResponse.json({ error: 'Child not linked to this parent' }, { status: 403 })

  const settings = await getOrCreateParentSettings(parentProfile.id, params.childId)
  return NextResponse.json(settings)
}

// PATCH /api/vault/parent/settings/[childId]
export async function PATCH(req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canActAsParent(getUserRole(user))) {
    return NextResponse.json({ error: 'Only parent accounts can update vault settings' }, { status: 403 })
  }

  let body: {
    familyRewardOptions?: Array<{ label: string }>
    maxRequestsPerMonth?: number
    physicalRewardsEnabled?: boolean
    deliveryAddress?: DeliveryAddress | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parentProfile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!parentProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const linked = await verifyParentChildLink(user.id, params.childId)
  if (!linked) return NextResponse.json({ error: 'Child not linked to this parent' }, { status: 403 })

  try {
    const settings = await updateParentSettings(parentProfile.id, params.childId, body)
    return NextResponse.json(settings)
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
