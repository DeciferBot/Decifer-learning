// Reward Vault — reward request lifecycle.
// Reads from vault + learning tables. Writes to reward_requests and child_vault_status only.
// SAFETY: no imports from lib/points, lib/sm2, lib/cards, lib/adaptive.

import { prisma } from '@/lib/prisma'
import { NullCommerceAdapter } from './commerce-adapter'

const commerce = new NullCommerceAdapter()

export class VaultError extends Error {
  constructor(
    public readonly code:
      | 'INSUFFICIENT_CREDITS'
      | 'DUPLICATE_PENDING'
      | 'NO_PARENT_LINKED'
      | 'MONTHLY_LIMIT_REACHED'
      | 'MESSAGE_TOO_LONG'
      | 'REQUEST_NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'INVALID_TRANSITION',
    message: string,
  ) {
    super(message)
    this.name = 'VaultError'
  }
}

export interface ParentResponseInput {
  action: 'approve' | 'reject' | 'defer' | 'counter_offer'
  note?: string
  rewardType?: 'family' | 'manual' | 'physical'
  rewardLabel?: string
}

export interface ChildResponseInput {
  action: 'accept_counter' | 'dismiss_counter'
}

export async function createRewardRequest(
  childProfileId: string,
  message: string,
) {
  const trimmed = message.trim()
  if (trimmed.length > 120) {
    throw new VaultError('MESSAGE_TOO_LONG', 'Message must be 120 characters or fewer')
  }

  const child = await prisma.profile.findUnique({
    where: { id: childProfileId },
    select: {
      total_points: true,
      streak_days: true,
      profile_badges: { select: { badge_id: true } },
      family_as_child: {
        select: { parent: { select: { id: true } } },
      },
      vault_status: { select: { credit_balance: true, current_band: true } },
    },
  })
  if (!child) throw new Error(`Profile ${childProfileId} not found`)

  if ((child.vault_status?.credit_balance ?? 0) < 1) {
    throw new VaultError('INSUFFICIENT_CREDITS', 'No credits available — earn a new milestone to get more')
  }

  if (child.family_as_child.length === 0) {
    throw new VaultError('NO_PARENT_LINKED', 'No parent account is linked to this profile')
  }

  // Stage 1: route to first linked parent
  const parentProfileId = child.family_as_child[0].parent.id

  const existingActive = await prisma.rewardRequest.findFirst({
    where: {
      child_profile_id: childProfileId,
      status: { in: ['pending', 'deferred', 'counter_offered'] },
    },
    select: { id: true },
  })
  if (existingActive) {
    throw new VaultError('DUPLICATE_PENDING', 'A reward request is already in progress')
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const [parentSettings, requestsThisMonth, topicsCompleted] = await Promise.all([
    prisma.vaultParentSettings.findUnique({
      where: {
        parent_profile_id_child_profile_id: {
          parent_profile_id: parentProfileId,
          child_profile_id: childProfileId,
        },
      },
      select: { max_requests_per_month: true },
    }),
    prisma.rewardRequest.count({
      where: { child_profile_id: childProfileId, created_at: { gte: monthStart } },
    }),
    prisma.topicProgress.count({
      where: { profile_id: childProfileId, status: 'completed' },
    }),
  ])

  const maxPerMonth = parentSettings?.max_requests_per_month ?? 1
  if (requestsThisMonth >= maxPerMonth) {
    throw new VaultError(
      'MONTHLY_LIMIT_REACHED',
      `You can make ${maxPerMonth} reward request(s) per month`,
    )
  }

  return prisma.$transaction(async (tx) => {
    const request = await tx.rewardRequest.create({
      data: {
        child_profile_id: childProfileId,
        parent_profile_id: parentProfileId,
        milestone_band: child.vault_status?.current_band ?? 'none',
        xp_at_request: child.total_points,
        topics_at_request: topicsCompleted,
        badges_at_request: child.profile_badges.length,
        streak_at_request: child.streak_days,
        child_message: trimmed || null,
        credits_used: 1,
        status: 'pending',
      },
    })
    await tx.childVaultStatus.update({
      where: { profile_id: childProfileId },
      data: { credit_balance: { decrement: 1 } },
    })
    return request
  })
}

export async function respondToRequest(
  requestId: string,
  responderProfileId: string,
  input: ParentResponseInput | ChildResponseInput,
) {
  const request = await prisma.rewardRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      child_profile_id: true,
      parent_profile_id: true,
      credits_used: true,
      reward_label: true,
      milestone_band: true,
    },
  })
  if (!request) throw new VaultError('REQUEST_NOT_FOUND', 'Reward request not found')

  const isParent = responderProfileId === request.parent_profile_id
  const isChild = responderProfileId === request.child_profile_id

  if (!isParent && !isChild) {
    throw new VaultError('UNAUTHORIZED', 'Not authorised to respond to this request')
  }

  const action = input.action

  // Validate allowed transitions
  // Parents can act on both pending and deferred requests.
  if (request.status === 'pending' || request.status === 'deferred') {
    if (!isParent || !['approve', 'reject', 'defer', 'counter_offer'].includes(action)) {
      throw new VaultError('INVALID_TRANSITION', `Action '${action}' is not allowed on a ${request.status} request`)
    }
  } else if (request.status === 'counter_offered') {
    if (!isChild || !['accept_counter', 'dismiss_counter'].includes(action)) {
      throw new VaultError('INVALID_TRANSITION', `Action '${action}' is not allowed on a counter-offered request`)
    }
  } else {
    throw new VaultError('INVALID_TRANSITION', `Request in status '${request.status}' cannot be updated`)
  }

  const parentInput = input as ParentResponseInput
  const now = new Date()

  if (action === 'approve' || action === 'accept_counter') {
    const effectiveRewardType = action === 'approve' ? (parentInput.rewardType ?? 'family') : 'family'
    const isPhysical = effectiveRewardType === 'physical'

    // Commerce adapter call (NullCommerceAdapter — no-op for family; physical creates a
    // RewardFulfilment tracking row so admin can update its status)
    await commerce.createOrder({
      requestId: request.id,
      childProfileId: request.child_profile_id,
      rewardLabel: parentInput.rewardLabel ?? request.reward_label,
      milestoneBand: request.milestone_band,
    })

    return prisma.$transaction(async (tx) => {
      const updated = await tx.rewardRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          responded_by_profile_id: responderProfileId,
          responded_at: now,
          ...(parentInput.note !== undefined && { parent_response_note: parentInput.note }),
          ...(action === 'approve' && parentInput.rewardType && { reward_type: parentInput.rewardType }),
          ...(action === 'approve' && parentInput.rewardLabel && { reward_label: parentInput.rewardLabel }),
        },
      })

      // For physical rewards, create a fulfilment tracking row (admin manages its status)
      if (isPhysical) {
        await tx.rewardFulfilment.upsert({
          where: { request_id: requestId },
          create: { request_id: requestId, status: 'approved' },
          update: {},
        })
      }

      return updated
    })
  }

  if (action === 'reject') {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.rewardRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          responded_by_profile_id: responderProfileId,
          responded_at: now,
          parent_response_note: parentInput.note ?? null,
        },
      })
      await tx.childVaultStatus.update({
        where: { profile_id: request.child_profile_id },
        data: { credit_balance: { increment: request.credits_used } },
      })
      return updated
    })
  }

  if (action === 'defer') {
    return prisma.rewardRequest.update({
      where: { id: requestId },
      data: {
        status: 'deferred',
        responded_by_profile_id: responderProfileId,
        responded_at: now,
        parent_response_note: parentInput.note ?? null,
      },
    })
  }

  if (action === 'counter_offer') {
    return prisma.rewardRequest.update({
      where: { id: requestId },
      data: {
        status: 'counter_offered',
        responded_by_profile_id: responderProfileId,
        responded_at: now,
        parent_response_note: parentInput.note ?? null,
        reward_type: parentInput.rewardType ?? null,
        reward_label: parentInput.rewardLabel ?? null,
      },
    })
  }

  if (action === 'dismiss_counter') {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.rewardRequest.update({
        where: { id: requestId },
        data: {
          status: 'cancelled',
          responded_by_profile_id: responderProfileId,
          responded_at: now,
        },
      })
      await tx.childVaultStatus.update({
        where: { profile_id: request.child_profile_id },
        data: { credit_balance: { increment: request.credits_used } },
      })
      return updated
    })
  }

  // Unreachable — TypeScript exhaustiveness guard
  throw new VaultError('INVALID_TRANSITION', `Unhandled action: ${action}`)
}

export async function markFulfilled(requestId: string, parentProfileId: string) {
  const request = await prisma.rewardRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, parent_profile_id: true },
  })
  if (!request) throw new VaultError('REQUEST_NOT_FOUND', 'Reward request not found')

  if (request.parent_profile_id !== parentProfileId) {
    throw new VaultError('UNAUTHORIZED', 'Not authorised to fulfil this request')
  }

  if (request.status !== 'approved') {
    throw new VaultError('INVALID_TRANSITION', `Only approved requests can be marked fulfilled (current: ${request.status})`)
  }

  return prisma.rewardRequest.update({
    where: { id: requestId },
    data: { status: 'completed', responded_at: new Date() },
  })
}
