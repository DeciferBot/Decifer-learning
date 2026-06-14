/**
 * Item Response Theory (Rasch / 1-PL) calibration for Decifer Learning.
 *
 * WHY: today every question's difficulty is a fixed editorial `tier`
 * (sprout/explorer/lightning). World-class adaptive systems instead CALIBRATE
 * difficulty from real student responses and select items near each child's
 * estimated ability. This module is the math core of that closed loop:
 *
 *     responses ──▶ difficultyFromResponses()  ──▶  quiz_questions.difficulty_b
 *     child history ──▶ abilityFromResponses() ──▶  θ (theta)
 *     θ + item b ──▶ rankByTargetDifficulty()  ──▶  adaptive selection
 *
 * The model: P(correct | θ, b) = 1 / (1 + e^-(θ − b))
 *   θ = learner ability (logits), b = item difficulty (logits).
 *   Higher b ⇒ harder item ⇒ lower P(correct).
 *
 * Design choices that keep this stable on the modest data of a family pilot:
 *   - Laplace smoothing on the proportion-correct so 0/N and N/N don't blow up.
 *   - A minimum sample size before an item is considered calibrated.
 *   - A one-step Rasch ability estimate (mean item difficulty + logit of the
 *     smoothed success rate) — monotonic, closed-form, no iterative solver to
 *     diverge on sparse data. Upgrade to full MLE/EAP when traffic justifies it.
 *
 * PURE: no DB, no network, no AI. Deterministic and fully unit-tested.
 */

export type Tier = 'sprout' | 'explorer' | 'lightning'

/** Minimum first-attempt responses before an item's difficulty is trusted.
 *  Aligned with the §9 anomaly-detection threshold (≥20 attempts). */
export const MIN_CALIBRATION_N = 20

/** Difficulty/ability are clamped to this logit range to stay numerically sane. */
export const LOGIT_CLAMP = 4

/** Tier boundaries on the difficulty (b) scale, used to recommend re-tiering. */
export const TIER_DIFFICULTY_BANDS: Record<Tier, [number, number]> = {
  sprout: [-LOGIT_CLAMP, -0.6],
  explorer: [-0.6, 1.0],
  lightning: [1.0, LOGIT_CLAMP],
}

function clamp(x: number, lo = -LOGIT_CLAMP, hi = LOGIT_CLAMP): number {
  return Math.max(lo, Math.min(hi, x))
}

function logit(p: number): number {
  return Math.log(p / (1 - p))
}

/** Logistic — P(correct) for ability θ on item of difficulty b. */
export function expectedCorrectness(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)))
}

export interface ItemStats {
  /** First-attempt correct responses. */
  correct: number
  /** Total first-attempt responses. */
  total: number
}

/**
 * Calibrate an item's Rasch difficulty `b` from aggregate response stats.
 *
 * Returns null when there is not yet enough data (total < MIN_CALIBRATION_N) so
 * the caller leaves the item uncalibrated rather than trusting noise.
 *
 *   p = (correct + 0.5) / (total + 1)     ← Laplace smoothing
 *   b = logit(1 − p) = ln((1 − p) / p)    ← harder items (low p) get higher b
 */
export function difficultyFromResponses({ correct, total }: ItemStats): number | null {
  if (!Number.isFinite(correct) || !Number.isFinite(total)) return null
  if (total < MIN_CALIBRATION_N || correct < 0 || correct > total) return null
  const p = (correct + 0.5) / (total + 1)
  return clamp(logit(1 - p))
}

export interface AbilityResponse {
  /** Calibrated difficulty of the item, or null if the item isn't calibrated yet. */
  difficulty_b: number | null
  correct: boolean
}

/**
 * Estimate a learner's ability θ from their responses to calibrated items.
 *
 * One-step Rasch approximation:
 *   θ ≈ mean(b over calibrated items answered) + logit(smoothed success rate)
 *
 * Uncalibrated items (null difficulty) are ignored for the difficulty anchor but
 * still count toward the success rate. With zero usable responses, returns 0
 * (the neutral ability prior).
 */
export function abilityFromResponses(responses: AbilityResponse[]): number {
  if (responses.length === 0) return 0
  const calibrated = responses.filter((r) => r.difficulty_b != null)
  const meanB =
    calibrated.length > 0
      ? calibrated.reduce((s, r) => s + (r.difficulty_b as number), 0) / calibrated.length
      : 0
  const correctCount = responses.filter((r) => r.correct).length
  // Laplace-smoothed success rate over ALL responses.
  const p = (correctCount + 0.5) / (responses.length + 1)
  return clamp(meanB + logit(p))
}

/** Recommend the editorial tier a calibrated difficulty best matches.
 *  Feeds the content pipeline / admin so mis-tiered items can be corrected. */
export function recommendTier(b: number): Tier {
  if (b < TIER_DIFFICULTY_BANDS.sprout[1]) return 'sprout'
  if (b < TIER_DIFFICULTY_BANDS.explorer[1]) return 'explorer'
  return 'lightning'
}

/**
 * Order items so those closest to the learner's ability come first
 * (target P(correct) ≈ 0.5–0.6, the desirable-difficulty sweet spot).
 *
 * Stable: ties and uncalibrated items keep their input order. Uncalibrated
 * items are treated as "ability-neutral" (distance 0-biased toward the middle)
 * so a cold-start pool degrades gracefully to the caller's existing ordering.
 *
 * This does NOT bypass tier gates — callers apply it WITHIN a tier-balanced
 * selection to choose the most appropriately-pitched items of each tier.
 */
export function rankByTargetDifficulty<T extends { difficulty_b: number | null }>(
  items: T[],
  theta: number,
): T[] {
  return items
    .map((item, idx) => {
      // Aim slightly above ability (b = θ + 0.2) so items stretch without frustrating.
      const target = theta + 0.2
      const distance = item.difficulty_b == null ? Number.POSITIVE_INFINITY : Math.abs(item.difficulty_b - target)
      return { item, idx, distance }
    })
    .sort((a, b) => (a.distance === b.distance ? a.idx - b.idx : a.distance - b.distance))
    .map((x) => x.item)
}
