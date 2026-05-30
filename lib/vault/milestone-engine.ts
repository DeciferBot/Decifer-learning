// Reward Vault — milestone engine.
// Pure functions only. No DB calls, no side effects. Testable without network.
// SAFETY: never imports lib/points, lib/sm2, lib/cards, lib/adaptive.

export type MilestoneBand = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum'

// XP deducted from milestone progress per hint used (across all quizzes).
// On top of the per-question deduction already applied in lib/points.ts.
export const MILESTONE_HINT_PENALTY_PER_HINT = 5
// Maximum fraction of totalPoints that the hint penalty can consume.
export const MILESTONE_HINT_PENALTY_CAP = 0.3

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
  totalHintsUsed: number
  topicsCompleted: number
  badgeCount: number
  guardianWin: boolean
  publishedTopicsForYearGroup: number
}

/** XP deducted from milestone eligibility due to hint usage. */
export function calcHintPenaltyXP(totalPoints: number, totalHintsUsed: number): number {
  const raw = totalHintsUsed * MILESTONE_HINT_PENALTY_PER_HINT
  const cap = Math.floor(totalPoints * MILESTONE_HINT_PENALTY_CAP)
  return Math.min(raw, cap)
}

/** Effective XP used for milestone band qualification. */
export function effectiveXP(totalPoints: number, totalHintsUsed: number): number {
  return Math.max(0, totalPoints - calcHintPenaltyXP(totalPoints, totalHintsUsed))
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
  effectiveXP: number
  hintPenaltyXP: number
}

function bandOrder(band: string): number {
  const order: Record<string, number> = { none: 0, bronze: 1, silver: 2, gold: 3, platinum: 4 }
  return order[band] ?? 0
}

function childQualifiesForBand(
  xp: number,
  snapshot: LearningSnapshot,
  milestone: MilestoneConfig,
): boolean {
  if (!milestone.is_active) return false

  // If the child has completed every published topic available to them, waive the hint
  // penalty — they have no remaining quizzes to improve their score and should not be
  // permanently blocked from a milestone they otherwise earned.
  const hasFinishedAllTopics =
    snapshot.publishedTopicsForYearGroup > 0 &&
    snapshot.topicsCompleted >= snapshot.publishedTopicsForYearGroup

  const effectiveXpForCheck = hasFinishedAllTopics ? snapshot.totalPoints : xp
  if (effectiveXpForCheck < milestone.xp_required) return false

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

  const penalty = calcHintPenaltyXP(snapshot.totalPoints, snapshot.totalHintsUsed)
  const xp = effectiveXP(snapshot.totalPoints, snapshot.totalHintsUsed)

  // Find highest band the child qualifies for (using hint-penalised XP)
  let highestBand: MilestoneBand = 'none'
  let creditsToAward = 0

  for (const milestone of sorted) {
    if (childQualifiesForBand(xp, snapshot, milestone)) {
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
        xpNeeded: Math.max(0, nextMilestone.xp_required - xp),
        topicsNeeded: Math.max(0, nextMilestone.topics_required - snapshot.topicsCompleted),
        badgesNeeded: Math.max(0, nextMilestone.badges_required - snapshot.badgeCount),
        guardianRequired: nextMilestone.guardian_required,
        xpTotal: xp,
        topicsTotal: snapshot.topicsCompleted,
      }
    : {
        xpNeeded: 0,
        topicsNeeded: 0,
        badgesNeeded: 0,
        guardianRequired: false,
        xpTotal: xp,
        topicsTotal: snapshot.topicsCompleted,
      }

  return {
    currentBand: highestBand,
    highestQualifyingBand: highestBand,
    creditsToAward,
    nextMilestone,
    progressToNext,
    effectiveXP: xp,
    hintPenaltyXP: penalty,
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
