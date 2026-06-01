import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-guard'
import { getAllRequests, getVaultStats } from '@/lib/vault/admin'

// GET /api/admin/vault/requests
// Admin reads all reward requests with optional ?status= filter.
// ?stats=true returns aggregate stats instead.
export async function GET(req: Request) {
  const denied = await requireAdminApi()
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const statsMode = searchParams.get('stats') === 'true'

  if (statsMode) {
    const stats = await getVaultStats()
    return NextResponse.json(stats)
  }

  const status = searchParams.get('status') ?? undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const format = searchParams.get('format')

  const requests = await getAllRequests({ status, limit, offset })

  if (format === 'csv') {
    const HEADERS = [
      'id', 'status', 'child', 'parent', 'milestone_band',
      'xp_at_request', 'topics_at_request', 'credits_used',
      'child_message', 'parent_note', 'reward_type', 'reward_label',
      'created_at', 'responded_at',
    ]
    function escapeCell(v: string | number | null | undefined): string {
      return `"${String(v ?? '').replace(/"/g, '""')}"`
    }
    const rows = requests.map((r) => [
      r.id, r.status, r.childName, r.parentName, r.milestoneBand,
      r.xpAtRequest, r.topicsAtRequest, r.creditsUsed,
      r.childMessage, r.parentNote, r.rewardType, r.rewardLabel,
      r.createdAt.toISOString(), r.respondedAt?.toISOString() ?? '',
    ].map(escapeCell).join(','))
    const csv = [HEADERS.join(','), ...rows].join('\n')
    const date = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reward-vault-${date}.csv"`,
      },
    })
  }

  return NextResponse.json(requests)
}
