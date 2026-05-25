// Reward Vault — vault status queries and milestone check.
// Reads from learning tables (profiles, topic_progress, profile_badges) via Prisma.
// Writes only to vault tables. Never writes to learning tables.
// SAFETY: no imports from lib/points, lib/sm2, lib/cards, lib/adaptive.

import { prisma } from '@/lib/prisma'
import {
  computeMilestone,
  getBandDisplayName,
  type MilestoneBand,
  type LearningSnapshot,
  type MilestoneConfig,
  type MilestoneProgress,
} from './milestone-engine'

export interface VaultStatus {
  currentBand: MilestoneBand
  currentBandDisplayName: string
  currentBandReachedAt: Date | null
  creditBalance: number
  pendingRequest: PendingRequestSummary | null
  nextMilestone: NextMilestoneSummary | null
  progressToNext: MilestoneProgress
  currentXP: number
  currentTopicsCompleted: number
  currentBadgeCount: number
  currentStreak: number
}

export interface PendingRequestSummary {
  id: string
  status: string
  childMessage: string | null
  parentResponseNote: string | null
  createdAt: Date
}

export interface NextMilestoneSummary {
  band: string
  displayName: string
  xpRequired: number
  topicsRequired: number
  badgesRequired: number
  guardianRequired: boolean
}

export interface MilestoneCheckResult {
  changed: boolean
  previousBand: MilestoneBand
  newBand: MilestoneBand
  creditsAwarded: number
}

const DEFAULT_FAMILY_REWARD_OPTIONS = [
  { label: 'Movie night at home' },
  { label: 'Trip to a bookshop' },
  { label: 'Museum or science centre visit' },
  { label: 'Favourite meal of their choice' },
  { label: 'Extra reading time together' },
]

async function loadMilestoneConfigs(): Promise<MilestoneConfig[]> {
  const rows = await prisma.vaultMilestone.findMany({ where: { is_active: true } })
  return rows.map((r) => ({
    band: r.band,
    display_name: r.display_name,
    xp_required: r.xp_required,
    topics_required: r.topics_required,
    badges_required: r.badges_required,
    guardian_required: r.guardian_required,
    credits_awarded: r.credits_awarded,
    order_index: r.order_index,
    is_active: r.is_active,
  }))
}

async function loadLearningSnapshot(profileId: string): Promise<LearningSnapshot> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      total_points: true,
      streak_days: true,
      year_group_id: true,
      profile_badges: { select: { badge_id: true } },
    },
  })
  if (!profile) throw new Error(`Profile ${profileId} not found`)

  const [topicsCompleted, publishedTopicsForYearGroup, guardianBadge] = await Promise.all([
    prisma.topicProgress.count({ where: { profile_id: profileId, status: 'completed' } }),
    profile.year_group_id
      ? prisma.topic.count({
          where: { year_group_id: profile.year_group_id, is_published: true },
        })
      : Promise.resolve(0),
    // Guardian win is any badge with trigger_rule.type === 'guardian_win'
    prisma.profileBadge.findFirst({
      where: { profile_id: profileId },
      include: { badge: { select: { trigger_rule: true } } },
    }),
  ])

  const guardianWin =
    guardianBadge !== null &&
    typeof guardianBadge.badge.trigger_rule === 'object' &&
    guardianBadge.badge.trigger_rule !== null &&
    (guardianBadge.badge.trigger_rule as { type?: string }).type === 'guardian_win'

  // More accurate: check all badges for guardian_win type
  const allBadges = await prisma.profileBadge.findMany({
    where: { profile_id: profileId },
    include: { badge: { select: { trigger_rule: true } } },
  })
  const hasGuardianWin = allBadges.some(
    (pb) =>
      typeof pb.badge.trigger_rule === 'object' &&
      pb.badge.trigger_rule !== null &&
      (pb.badge.trigger_rule as { type?: string }).type === 'guardian_win',
  )

  return {
    totalPoints: profile.total_points,
    topicsCompleted,
    badgeCount: profile.profile_badges.length,
    guardianWin: hasGuardianWin,
    publishedTopicsForYearGroup,
  }
}

export async function getVaultStatus(profileId: string): Promise<VaultStatus> {
  const [milestones, snapshot, vaultStatus, pendingRequest] = await Promise.all([
    loadMilestoneConfigs(),
    loadLearningSnapshot(profileId),
    prisma.childVaultStatus.findUnique({ where: { profile_id: profileId } }),
    prisma.rewardRequest.findFirst({
      where: {
        child_profile_id: profileId,
        status: { in: ['pending', 'deferred', 'counter_offered', 'approved'] },
      },
      orderBy: { created_at: 'desc' },
    }),
  ])

  const result = computeMilestone(snapshot, milestones)
  const currentBand = (vaultStatus?.current_band as MilestoneBand) ?? 'none'
  const creditBalance = vaultStatus?.credit_balance ?? 0

  const pendingRequestSummary: PendingRequestSummary | null = pendingRequest
    ? {
        id: pendingRequest.id,
        status: pendingRequest.status,
        childMessage: pendingRequest.child_message,
        parentResponseNote: pendingRequest.parent_response_note,
        createdAt: pendingRequest.created_at,
      }
    : null

  const nextMilestoneSummary: NextMilestoneSummary | null = result.nextMilestone
    ? {
        band: result.nextMilestone.band,
        displayName: result.nextMilestone.display_name,
        xpRequired: result.nextMilestone.xp_required,
        topicsRequired: result.nextMilestone.topics_required,
        badgesRequired: result.nextMilestone.badges_required,
        guardianRequired: result.nextMilestone.guardian_required,
      }
    : null

  return {
    currentBand,
    currentBandDisplayName: getBandDisplayName(currentBand),
    currentBandReachedAt: vaultStatus?.current_band_reached_at ?? null,
    creditBalance,
    pendingRequest: pendingRequestSummary,
    nextMilestone: nextMilestoneSummary,
    progressToNext: result.progressToNext,
    currentXP: snapshot.totalPoints,
    currentTopicsCompleted: snapshot.topicsCompleted,
    currentBadgeCount: snapshot.badgeCount,
    currentStreak: await prisma.profile
      .findUnique({ where: { id: profileId }, select: { streak_days: true } })
      .then((p) => p?.streak_days ?? 0),
  }
}

export async function checkAndUpdateMilestone(profileId: string): Promise<MilestoneCheckResult> {
  const [milestones, snapshot] = await Promise.all([
    loadMilestoneConfigs(),
    loadLearningSnapshot(profileId),
  ])

  const result = computeMilestone(snapshot, milestones)

  // Get or create vault status row
  const existing = await prisma.childVaultStatus.upsert({
    where: { profile_id: profileId },
    create: {
      profile_id: profileId,
      current_band: 'none',
      credit_balance: 0,
      credits_earned_total: 0,
      last_milestone_check: new Date(),
    },
    update: { last_milestone_check: new Date() },
  })

  const existingBand = existing.current_band as MilestoneBand
  const newBand = result.highestQualifyingBand

  // Only award credits and update if this is a new band transition
  if (newBand === existingBand || newBand === 'none') {
    return { changed: false, previousBand: existingBand, newBand: existingBand, creditsAwarded: 0 }
  }

  // Determine bands that the child has newly passed through (in case of multiple level-ups)
  const bandOrder: MilestoneBand[] = ['none', 'bronze', 'silver', 'gold', 'platinum']
  const existingIdx = bandOrder.indexOf(existingBand)
  const newIdx = bandOrder.indexOf(newBand)

  // Only award credits for bands not yet recorded in vault_milestone_events
  const existingEvents = await prisma.vaultMilestoneEvent.findMany({
    where: { profile_id: profileId },
    select: { band: true },
  })
  const awardedBands = new Set(existingEvents.map((e) => e.band))

  let totalNewCredits = 0
  const newBandEvents: Array<{ band: string; creditsAwarded: number }> = []

  for (let i = existingIdx + 1; i <= newIdx; i++) {
    const band = bandOrder[i]
    if (band === 'none') continue
    if (awardedBands.has(band)) continue

    const milestoneCfg = milestones.find((m) => m.band === band)
    const credits = milestoneCfg?.credits_awarded ?? 1
    totalNewCredits += credits
    newBandEvents.push({ band, creditsAwarded: credits })
  }

  if (newBandEvents.length === 0) {
    // Already awarded; just update the band label
    await prisma.childVaultStatus.update({
      where: { profile_id: profileId },
      data: { current_band: newBand, current_band_reached_at: new Date() },
    })
    return { changed: true, previousBand: existingBand, newBand, creditsAwarded: 0 }
  }

  await prisma.$transaction(async (tx) => {
    await tx.childVaultStatus.update({
      where: { profile_id: profileId },
      data: {
        current_band: newBand,
        current_band_reached_at: new Date(),
        credit_balance: { increment: totalNewCredits },
        credits_earned_total: { increment: totalNewCredits },
        last_milestone_check: new Date(),
      },
    })

    await tx.vaultMilestoneEvent.createMany({
      data: newBandEvents.map((e) => ({
        profile_id: profileId,
        band: e.band,
        credits_awarded: e.creditsAwarded,
        xp_snapshot: snapshot.totalPoints,
        topics_snapshot: snapshot.topicsCompleted,
      })),
    })

    // Ensure default parent settings exist for all linked parents
    const links = await tx.familyLink.findMany({
      where: { child_user_id: await tx.profile.findUnique({ where: { id: profileId }, select: { user_id: true } }).then(p => p!.user_id) },
      include: { parent: { select: { id: true } } },
    })
    for (const link of links) {
      await tx.vaultParentSettings.upsert({
        where: { parent_profile_id_child_profile_id: { parent_profile_id: link.parent.id, child_profile_id: profileId } },
        create: {
          parent_profile_id: link.parent.id,
          child_profile_id: profileId,
          family_reward_options: DEFAULT_FAMILY_REWARD_OPTIONS,
        },
        update: {},
      })
    }
  })

  return { changed: true, previousBand: existingBand, newBand, creditsAwarded: totalNewCredits }
}
