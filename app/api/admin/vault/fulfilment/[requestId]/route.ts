// Reward Vault — admin fulfilment status machine.
// Manages physical reward fulfilment lifecycle: approved → dispatched → delivered.
// Admin only. Never writes to learning tables.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['approved', 'dispatched', 'delivered']
const VALID_TRANSITIONS: Record<string, string[]> = {
  approved:   ['dispatched'],
  dispatched: ['delivered'],
  delivered:  [],
}

type Params = { params: { requestId: string } }

// PATCH /api/admin/vault/fulfilment/[requestId]
// Advance fulfilment status or update tracking/notes.
export async function PATCH(req: Request, { params }: Params) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (getUserRole(user) !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  let body: { status?: string; tracking_number?: string; admin_notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fulfilment = await prisma.rewardFulfilment.findUnique({
    where: { request_id: params.requestId },
    select: { id: true, status: true },
  })
  if (!fulfilment) {
    return NextResponse.json({ error: 'Fulfilment record not found' }, { status: 404 })
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 422 })
    }
    const allowed = VALID_TRANSITIONS[fulfilment.status] ?? []
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${fulfilment.status}' to '${body.status}'`,
          code: 'INVALID_TRANSITION',
        },
        { status: 422 },
      )
    }
  }

  const data: Record<string, unknown> = {}
  if (body.status !== undefined)           data.status = body.status
  if (body.tracking_number !== undefined)  data.tracking_number = body.tracking_number || null
  if (body.admin_notes !== undefined)      data.admin_notes = body.admin_notes || null

  const updated = await prisma.rewardFulfilment.update({
    where: { request_id: params.requestId },
    data,
  })
  return NextResponse.json(updated)
}
