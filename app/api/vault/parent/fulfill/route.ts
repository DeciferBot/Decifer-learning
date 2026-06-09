import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole, canActAsParent } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { markFulfilled, VaultError } from '@/lib/vault/requests'

// POST /api/vault/parent/fulfill
// Parent marks an approved reward request as completed (given IRL).
// Parent-only. No learning data is modified.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canActAsParent(getUserRole(user))) {
    return NextResponse.json(
      { error: 'Only parent accounts can mark rewards as done' },
      { status: 403 },
    )
  }

  let body: { requestId: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
  }

  const parentProfile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!parentProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  try {
    const updated = await markFulfilled(body.requestId, parentProfile.id)
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof VaultError) {
      const status =
        err.code === 'REQUEST_NOT_FOUND' ? 404 : err.code === 'UNAUTHORIZED' ? 403 : 422
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    throw err
  }
}
