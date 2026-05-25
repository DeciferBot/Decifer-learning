// Reward Vault — parent settings management.
// Reads and writes vault_parent_settings only.
// SAFETY: no imports from lib/points, lib/sm2, lib/cards, lib/adaptive.

import { prisma } from '@/lib/prisma'
import type { DeliveryAddress } from './commerce-adapter'

export type { DeliveryAddress }

export interface ParentSettingsUpdate {
  familyRewardOptions?: Array<{ label: string }>
  maxRequestsPerMonth?: number
  physicalRewardsEnabled?: boolean
  deliveryAddress?: DeliveryAddress | null
}

export async function getOrCreateParentSettings(
  parentProfileId: string,
  childProfileId: string,
) {
  return prisma.vaultParentSettings.upsert({
    where: {
      parent_profile_id_child_profile_id: {
        parent_profile_id: parentProfileId,
        child_profile_id: childProfileId,
      },
    },
    create: {
      parent_profile_id: parentProfileId,
      child_profile_id: childProfileId,
      family_reward_options: DEFAULT_FAMILY_REWARD_OPTIONS,
    },
    update: {},
  })
}

export async function updateParentSettings(
  parentProfileId: string,
  childProfileId: string,
  updates: ParentSettingsUpdate,
) {
  if (updates.maxRequestsPerMonth !== undefined) {
    if (
      !Number.isInteger(updates.maxRequestsPerMonth) ||
      updates.maxRequestsPerMonth < 0 ||
      updates.maxRequestsPerMonth > 12
    ) {
      throw new Error('maxRequestsPerMonth must be an integer between 0 and 12')
    }
  }

  if (updates.familyRewardOptions !== undefined) {
    if (!Array.isArray(updates.familyRewardOptions) || updates.familyRewardOptions.length > 20) {
      throw new Error('familyRewardOptions must be an array of up to 20 items')
    }
    for (const opt of updates.familyRewardOptions) {
      if (typeof opt.label !== 'string' || opt.label.trim().length === 0) {
        throw new Error('Each reward option must have a non-empty label')
      }
    }
  }

  const data: Record<string, unknown> = {}
  if (updates.familyRewardOptions !== undefined) {
    data.family_reward_options = updates.familyRewardOptions
  }
  if (updates.maxRequestsPerMonth !== undefined) {
    data.max_requests_per_month = updates.maxRequestsPerMonth
  }
  if (updates.physicalRewardsEnabled !== undefined) {
    data.physical_rewards_enabled = updates.physicalRewardsEnabled
  }
  if (updates.deliveryAddress !== undefined) {
    data.delivery_address = updates.deliveryAddress
  }

  return prisma.vaultParentSettings.upsert({
    where: {
      parent_profile_id_child_profile_id: {
        parent_profile_id: parentProfileId,
        child_profile_id: childProfileId,
      },
    },
    create: {
      parent_profile_id: parentProfileId,
      child_profile_id: childProfileId,
      family_reward_options: updates.familyRewardOptions ?? DEFAULT_FAMILY_REWARD_OPTIONS,
      max_requests_per_month: updates.maxRequestsPerMonth ?? 1,
    },
    update: data,
  })
}

const DEFAULT_FAMILY_REWARD_OPTIONS = [
  { label: 'Movie night at home' },
  { label: 'Trip to a bookshop' },
  { label: 'Museum or science centre visit' },
  { label: 'Favourite meal of their choice' },
  { label: 'Extra reading time together' },
]
