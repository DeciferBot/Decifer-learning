import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { respondToRequest, VaultError } from '@/lib/vault/requests'

type RespondBody = {
  requestId: string
  action: 'approve' | 'reject' | 'defer' | 'counter_offer' | 'accept_counter' | 'dismiss_counter'
  note?: string
  rewardType?: 'family' | 'manual' | 'physical'
  rewardLabel?: string
}

// POST /api/vault/parent/respond
// Parent responds to a pending request (approve/reject/defer/counter_offer).
// Child dismisses or accepts a counter-offer via the same endpoint (action determines path).
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getUserRole(user)
  if (role !== 'parent' && role !== 'child') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: RespondBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { requestId, action, note, rewardType, rewardLabel } = body
  if (!requestId || !action) {
    return NextResponse.json({ error: 'requestId and action are required' }, { status: 400 })
  }

  if (note !== undefined && note.length > 280) {
    return NextResponse.json(
      { error: 'Note must be 280 characters or fewer', code: 'NOTE_TOO_LONG' },
      { status: 422 },
    )
  }

  const callerProfile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!callerProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // physical rewards are locked in Stage 1
  if (rewardType === 'physical') {
    return NextResponse.json(
      { error: 'Physical rewards are not available yet', code: 'PHYSICAL_DISABLED' },
      { status: 422 },
    )
  }

  const input =
    action === 'accept_counter' || action === 'dismiss_counter'
      ? { action }
      : { action, note, rewardType, rewardLabel }

  try {
    const updated = await respondToRequest(requestId, callerProfile.id, input as Parameters<typeof respondToRequest>[2])
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof VaultError) {
      const status = err.code === 'REQUEST_NOT_FOUND' ? 404
        : err.code === 'UNAUTHORIZED' ? 403
        : 422
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    throw err
  }
}
