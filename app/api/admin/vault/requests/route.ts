import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { getAllRequests, getVaultStats } from '@/lib/vault/admin'

// GET /api/admin/vault/requests
// Admin reads all reward requests with optional ?status= filter.
// ?stats=true returns aggregate stats instead.
export async function GET(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (getUserRole(user) !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statsMode = searchParams.get('stats') === 'true'

  if (statsMode) {
    const stats = await getVaultStats()
    return NextResponse.json(stats)
  }

  const status = searchParams.get('status') ?? undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const requests = await getAllRequests({ status, limit, offset })
  return NextResponse.json(requests)
}
