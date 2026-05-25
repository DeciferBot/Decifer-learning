// Reward Vault — admin read queries.
// Read-only. No writes. Admin-only routes call these.
// SAFETY: no imports from lib/points, lib/sm2, lib/cards, lib/adaptive.

import { prisma } from '@/lib/prisma'

export interface AdminRequestRow {
  id: string
  status: string
  childName: string
  parentName: string
  milestoneBand: string
  childMessage: string | null
  parentNote: string | null
  rewardType: string | null
  rewardLabel: string | null
  creditsUsed: number
  createdAt: Date
  respondedAt: Date | null
  xpAtRequest: number
  topicsAtRequest: number
  fulfilmentStatus: string | null
}

export interface AdminVaultStats {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
  completedRequests: number
  totalCreditsAwarded: number
}

export async function getAllRequests(options?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<AdminRequestRow[]> {
  const rows = await prisma.rewardRequest.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { created_at: 'desc' },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
    select: {
      id: true,
      status: true,
      milestone_band: true,
      child_message: true,
      parent_response_note: true,
      reward_type: true,
      reward_label: true,
      credits_used: true,
      created_at: true,
      responded_at: true,
      xp_at_request: true,
      topics_at_request: true,
      child: { select: { display_name: true } },
      parent: { select: { display_name: true } },
      fulfilment: { select: { status: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    childName: r.child.display_name,
    parentName: r.parent.display_name,
    milestoneBand: r.milestone_band,
    childMessage: r.child_message,
    parentNote: r.parent_response_note,
    rewardType: r.reward_type,
    rewardLabel: r.reward_label,
    creditsUsed: r.credits_used,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
    xpAtRequest: r.xp_at_request,
    topicsAtRequest: r.topics_at_request,
    fulfilmentStatus: r.fulfilment?.status ?? null,
  }))
}

export async function getVaultStats(): Promise<AdminVaultStats> {
  const [statusCounts, creditSum] = await Promise.all([
    prisma.rewardRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.vaultMilestoneEvent.aggregate({
      _sum: { credits_awarded: true },
    }),
  ])

  const byStatus: Record<string, number> = {}
  for (const row of statusCounts) {
    byStatus[row.status] = row._count.id
  }

  const total = Object.values(byStatus).reduce((acc, n) => acc + n, 0)

  return {
    totalRequests: total,
    pendingRequests: byStatus['pending'] ?? 0,
    approvedRequests: (byStatus['approved'] ?? 0) + (byStatus['completed'] ?? 0),
    rejectedRequests: byStatus['rejected'] ?? 0,
    completedRequests: byStatus['completed'] ?? 0,
    totalCreditsAwarded: creditSum._sum.credits_awarded ?? 0,
  }
}
