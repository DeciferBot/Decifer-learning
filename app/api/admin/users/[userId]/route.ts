// DELETE /api/admin/users/[userId]
// Deletes a user from Supabase auth (cascades to profiles and all gameplay rows).
// Protected by the admin password gate.

import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Params = { params: { userId: string } }

export async function DELETE(_req: Request, { params }: Params) {
  const denied = await requireAdminApi()
  if (denied) return denied

  const { userId } = params
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const admin = createSupabaseAdminClient()

  // Supabase admin.deleteUser removes auth.users row; FK cascade removes profiles
  // and all child gameplay rows (quiz_attempts, topic_progress, etc.).
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
