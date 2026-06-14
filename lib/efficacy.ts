/**
 * Learning-efficacy analytics for Decifer Learning.
 *
 * WHY: a world-class ed-tech system must be able to answer the one question that
 * defines it — "does a child who uses this actually learn?" We collect NO
 * third-party analytics (Children's Code), so efficacy is measured first-party
 * from gameplay data already in the database.
 *
 * The headline metric is the NORMALISED LEARNING GAIN (Hake's g), the standard
 * pre/post measure in education research:
 *
 *     g = (post − pre) / (1 − pre)      for pre < 1
 *
 * It answers "of the headroom the child had, how much did they close?" — fairer
 * than a raw delta because improving 0.4→0.8 (g=0.67) is harder than 0.0→0.4
 * (g=0.40). Here pre = first quiz score on a topic, post = latest.
 *
 * Companion metrics: mastery rate, attempts/days to mastery, and spaced-review
 * retention (did mastery survive the gap until the SM-2 review?).
 *
 * PURE: every function below takes typed inputs and returns plain data — no DB,
 * no network, no AI. The DB loader lives in lib/efficacy-loader (server-only).
 */

/** A topic is "mastered" at ≥70% — the CLAUDE.md §14 Phase-5 pass line. */
export const MASTERY_THRESHOLD = 0.7

/** A later attempt counts as a spaced "review" once this many days have passed. */
export const RETENTION_GAP_DAYS = 3

export interface AttemptInput {
  profileId: string
  topicId: string
  /** Fractional score 0–1. */
  score: number
  createdAt: Date
}

export interface TopicMastery {
  profileId: string
  topicId: string
  attempts: number
  firstScore: number
  latestScore: number
  bestScore: number
  /** Raw improvement (latest − first). */
  delta: number
  /** Hake normalised gain, or null when pre-score is already 1 (no headroom). */
  normalisedGain: number | null
  mastered: boolean
  /** 1-based attempt number at which the child first crossed the mastery line. */
  attemptsToMastery: number | null
  /** Days from first attempt to first mastery. */
  daysToMastery: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Collapse a child's attempts on each topic into a per-topic mastery record.
 * Attempts are grouped by (profile, topic) and ordered chronologically.
 */
export function computeTopicMastery(attempts: AttemptInput[]): TopicMastery[] {
  const groups = new Map<string, AttemptInput[]>()
  for (const a of attempts) {
    const key = `${a.profileId}::${a.topicId}`
    const arr = groups.get(key)
    if (arr) arr.push(a)
    else groups.set(key, [a])
  }

  const out: TopicMastery[] = []
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const [profileId, topicId] = key.split('::')
    const first = sorted[0]
    const latest = sorted[sorted.length - 1]
    const bestScore = Math.max(...sorted.map((a) => a.score))

    let attemptsToMastery: number | null = null
    let daysToMastery: number | null = null
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].score >= MASTERY_THRESHOLD) {
        attemptsToMastery = i + 1
        daysToMastery = (sorted[i].createdAt.getTime() - first.createdAt.getTime()) / DAY_MS
        break
      }
    }

    const normalisedGain =
      first.score >= 1 ? null : (latest.score - first.score) / (1 - first.score)

    out.push({
      profileId,
      topicId,
      attempts: sorted.length,
      firstScore: first.score,
      latestScore: latest.score,
      bestScore,
      delta: latest.score - first.score,
      normalisedGain,
      mastered: bestScore >= MASTERY_THRESHOLD,
      attemptsToMastery,
      daysToMastery,
    })
  }
  return out
}

export interface RetentionRecord {
  topicId: string
  profileId: string
  /** Score on the attempt at/after which the topic was first mastered. */
  masteredScore: number
  /** Score on the first spaced review (≥ RETENTION_GAP_DAYS later). */
  reviewScore: number
  gapDays: number
  /** Did mastery survive the gap? */
  retained: boolean
}

/**
 * Spaced-retention: for each (profile, topic) where the child mastered the topic
 * and later re-attempted it after a gap of ≥ RETENTION_GAP_DAYS, did they still
 * pass? This is the signal that the SM-2 schedule is actually working — without
 * it, "mastery" could just be short-term cramming.
 */
export function computeRetention(attempts: AttemptInput[]): RetentionRecord[] {
  const groups = new Map<string, AttemptInput[]>()
  for (const a of attempts) {
    const key = `${a.profileId}::${a.topicId}`
    const arr = groups.get(key)
    if (arr) arr.push(a)
    else groups.set(key, [a])
  }

  const out: RetentionRecord[] = []
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const masteryIdx = sorted.findIndex((a) => a.score >= MASTERY_THRESHOLD)
    if (masteryIdx === -1) continue
    const mastered = sorted[masteryIdx]
    // First attempt after the mastery attempt that is also a spaced review.
    const review = sorted
      .slice(masteryIdx + 1)
      .find((a) => (a.createdAt.getTime() - mastered.createdAt.getTime()) / DAY_MS >= RETENTION_GAP_DAYS)
    if (!review) continue
    const [profileId, topicId] = key.split('::')
    out.push({
      profileId,
      topicId,
      masteredScore: mastered.score,
      reviewScore: review.score,
      gapDays: (review.createdAt.getTime() - mastered.createdAt.getTime()) / DAY_MS,
      retained: review.score >= MASTERY_THRESHOLD,
    })
  }
  return out
}

export interface EfficacySummary {
  topicsTracked: number
  childrenTracked: number
  /** Mean Hake normalised gain over topics that had headroom. */
  averageNormalisedGain: number | null
  /** Share of tracked topics where the child improved (delta > 0). */
  improvedRate: number
  /** Share of tracked topics ever mastered. */
  masteryRate: number
  /** Median attempts to first mastery (mastered topics only). */
  medianAttemptsToMastery: number | null
  /** Median days to first mastery (mastered topics only). */
  medianDaysToMastery: number | null
  /** Share of spaced reviews where mastery was retained. Null if no reviews yet. */
  retentionRate: number | null
  reviewsTracked: number
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function round(x: number | null, dp = 3): number | null {
  return x == null ? null : Number(x.toFixed(dp))
}

/**
 * Roll per-topic mastery + retention records into a cohort efficacy summary
 * suitable for the parent/admin surface or a marketing efficacy claim.
 */
export function summariseEfficacy(
  mastery: TopicMastery[],
  retention: RetentionRecord[],
): EfficacySummary {
  const children = new Set(mastery.map((m) => m.profileId))
  const gains = mastery.map((m) => m.normalisedGain).filter((g): g is number => g != null)
  const masteredTopics = mastery.filter((m) => m.mastered)

  const avgGain = gains.length ? gains.reduce((s, g) => s + g, 0) / gains.length : null
  const improvedRate = mastery.length
    ? mastery.filter((m) => m.delta > 0).length / mastery.length
    : 0
  const masteryRate = mastery.length ? masteredTopics.length / mastery.length : 0
  const retained = retention.filter((r) => r.retained).length

  return {
    topicsTracked: mastery.length,
    childrenTracked: children.size,
    averageNormalisedGain: round(avgGain),
    improvedRate: round(improvedRate) ?? 0,
    masteryRate: round(masteryRate) ?? 0,
    medianAttemptsToMastery: median(masteredTopics.map((m) => m.attemptsToMastery as number)),
    medianDaysToMastery: round(median(masteredTopics.map((m) => m.daysToMastery as number))),
    retentionRate: retention.length ? round(retained / retention.length) : null,
    reviewsTracked: retention.length,
  }
}

/** Convenience: attempts → full summary in one call. */
export function efficacyReport(attempts: AttemptInput[]): EfficacySummary {
  return summariseEfficacy(computeTopicMastery(attempts), computeRetention(attempts))
}
