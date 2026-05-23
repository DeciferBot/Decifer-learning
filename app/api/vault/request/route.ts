import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { prisma } from '@/lib/prisma'
import { createRewardRequest, VaultError } from '@/lib/vault/requests'

const VAULT_ERROR_STATUS: Record<string, number> = {
  INSUFFICIENT_CREDITS: 402,
  DUPLICATE_PENDING: 409,
  NO_PARENT_LINKED: 422,
  MONTHLY_LIMIT_REACHED: 429,
  MESSAGE_TOO_LONG: 422,
}

// POST /api/vault/request
// Child submits a reward request. Deducts 1 credit.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getUserRole(user)
  if (role !== 'child') {
    return NextResponse.json({ error: 'Only child accounts can submit reward requests' }, { status: 403 })
  }

  let body: { message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  try {
    const request = await createRewardRequest(profile.id, body.message ?? '')
    return NextResponse.json(request, { status: 201 })
  } catch (err) {
    if (err instanceof VaultError) {
      const status = VAULT_ERROR_STATUS[err.code] ?? 422
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    throw err
  }
}
