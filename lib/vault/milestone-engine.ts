// Reward Vault — milestone engine.
// Pure functions only. No DB calls, no side effects. Testable without network.
// SAFETY: never imports lib/points, lib/sm2, lib/cards, lib/adaptive.

export type MilestoneBand = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'

export interface MilestoneConfig {
  band: string
  display_name: string
  xp_required: number
  topics_required: number
  badges_required: number
  guardian_required: boolean
  credits_awarded: number
  order_index: number
  is_active: boolean
}

export interface LearningSnapshot {
  totalPoints: number
  topicsCompleted: number
  badgeCount: number
  guardianWin: boolean
  publishedTopicsForYearGroup: number
}

export interface MilestoneProgress {
  xpNeeded: number       // how many more XP to reach next milestone (0 if already there)
  topicsNeeded: number
  badgesNeeded: number
  guardianRequired: boolean
  xpTotal: number
  topicsTotal: number
}

export interface MilestoneResult {
  currentBand: MilestoneBand
  highestQualifyingBand: MilestoneBand
  creditsToAward: number
  nextMilestone: MilestoneConfig | null
  progressToNext: MilestoneProgress
}

function bandOrder(band: string): number {
  const order: Record<string, number> = { none: 0, bronze: 1, silver: 2, gold: 3, platinum: 4 }
  return order[band] ?? 0
}

function childQualifiesForBand(
  snapshot: LearningSnapshot,
  milestone: MilestoneConfig,
): boolean {
  if (!milestone.is_active) return false
  if (snapshot.totalPoints < milestone.xp_required) return false

  // Year-group safety rule: if fewer published topics than required, band is unreachable
  if (
    milestone.topics_required > 0 &&
    snapshot.publishedTopicsForYearGroup < milestone.topics_required
  ) {
    return false
  }
  if (snapshot.topicsCompleted < milestone.topics_required) return false
  if (snapshot.badgeCount < milestone.badges_required) return false
  if (milestone.guardian_required && !snapshot.guardianWin) return false
  return true
}

export function computeMilestone(
  snapshot: LearningSnapshot,
  milestones: MilestoneConfig[],
): MilestoneResult {
  const sorted = [...milestones]
    .filter((m) => m.is_active)
    .sort((a, b) => a.order_index - b.order_index)

  // Find highest band the child qualifies for
  let highestBand: MilestoneBand = 'none'
  let creditsToAward = 0

  for (const milestone of sorted) {
    if (childQualifiesForBand(snapshot, milestone)) {
      if (bandOrder(milestone.band) > bandOrder(highestBand)) {
        highestBand = milestone.band as MilestoneBand
        creditsToAward = milestone.credits_awarded
      }
    }
  }

  // Next milestone: lowest band above the highest qualifying one
  const nextMilestone =
    sorted.find(
      (m) =>
        bandOrder(m.band) > bandOrder(highestBand) &&
        // Skip bands that can never be reached (year-group topic cap)
        !(
          m.topics_required > 0 &&
          snapshot.publishedTopicsForYearGroup < m.topics_required
        ),
    ) ?? null

  const progressToNext: MilestoneProgress = nextMilestone
    ? {
        xpNeeded: Math.max(0, nextMilestone.xp_required - snapshot.totalPoints),
        topicsNeeded: Math.max(0, nextMilestone.topics_required - snapshot.topicsCompleted),
        badgesNeeded: Math.max(0, nextMilestone.badges_required - snapshot.badgeCount),
        guardianRequired: nextMilestone.guardian_required,
        xpTotal: snapshot.totalPoints,
        topicsTotal: snapshot.topicsCompleted,
      }
    : {
        xpNeeded: 0,
        topicsNeeded: 0,
        badgesNeeded: 0,
        guardianRequired: false,
        xpTotal: snapshot.totalPoints,
        topicsTotal: snapshot.topicsCompleted,
      }

  return {
    currentBand: highestBand,
    highestQualifyingBand: highestBand,
    creditsToAward,
    nextMilestone,
    progressToNext,
  }
}

export function getBandDisplayName(band: MilestoneBand): string {
  const names: Record<MilestoneBand, string> = {
    none: 'No milestone yet',
    bronze: 'Bronze Explorer',
    silver: 'Silver Achiever',
    gold: 'Gold Champion',
    platinum: 'Platinum Master',
  }
  return names[band]
}
