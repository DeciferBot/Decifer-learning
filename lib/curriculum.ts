/**
 * Curriculum completeness utilities.
 *
 * App rule (CLAUDE.md v2 addendum):
 *   A topic MUST NOT be displayed as "curriculum-complete" unless every
 *   outcome mapped to it is (a) mapped, (b) has all required content published,
 *   and (c) has verification_status = 'verified'.
 *
 * These functions are used by topic-display components and the world map.
 */

import { prisma } from './prisma'

export type CurriculumCoverageDetail = {
  topicId: string
  topicTitle: string
  totalOutcomes: number
  mappedOutcomes: number
  verifiedOutcomes: number
  contentGaps: Array<{ outcomeCode: string; missingTypes: string[] }>
  isCurriculumComplete: boolean
}

const TIER_MAP: Record<string, 'sprout' | 'explorer' | 'lightning'> = {
  quiz_sprout:    'sprout',
  quiz_explorer:  'explorer',
  quiz_lightning: 'lightning',
}

async function hasPublishedLearnContent(topicId: string): Promise<boolean> {
  const n = await prisma.learnContent.count({
    where: { topic_id: topicId, status: 'published' },
  })
  return n > 0
}

async function hasPracticeGames(topicId: string): Promise<boolean> {
  const n = await prisma.practiceGame.count({ where: { topic_id: topicId } })
  return n > 0
}

async function hasPublishedQuizTier(
  topicId: string,
  tier: 'sprout' | 'explorer' | 'lightning',
): Promise<boolean> {
  const n = await prisma.quizQuestion.count({
    where: { topic_id: topicId, tier, status: 'published' },
  })
  return n > 0
}

async function getMissingContentTypes(
  topicId: string,
  requiredContentTypes: string[],
): Promise<string[]> {
  const missing: string[] = []
  for (const ct of requiredContentTypes) {
    if (ct === 'learn'    && !(await hasPublishedLearnContent(topicId))) missing.push('learn')
    if (ct === 'practice' && !(await hasPracticeGames(topicId)))        missing.push('practice')
    const tier = TIER_MAP[ct]
    if (tier && !(await hasPublishedQuizTier(topicId, tier)))            missing.push(ct)
  }
  return missing
}

/**
 * Returns detailed curriculum coverage for a topic.
 * Used by admin dashboards and the parent dashboard's weak-area view.
 */
export async function getTopicCurriculumCoverage(
  topicId: string,
): Promise<CurriculumCoverageDetail | null> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { title: true },
  })
  if (!topic) return null

  const outcomes = await prisma.curriculumOutcome.findMany({
    where: { app_topic_id: topicId },
  })

  if (outcomes.length === 0) {
    return {
      topicId,
      topicTitle: topic.title,
      totalOutcomes: 0,
      mappedOutcomes: 0,
      verifiedOutcomes: 0,
      contentGaps: [],
      isCurriculumComplete: false,
    }
  }

  const contentGaps: CurriculumCoverageDetail['contentGaps'] = []
  let verifiedCount = 0

  for (const o of outcomes) {
    if (o.verification_status === 'verified') verifiedCount++

    const missing = await getMissingContentTypes(topicId, o.required_content_types as string[])
    if (missing.length > 0) {
      const outcomeCode = o.source_reference.split('|')[0].trim()
      contentGaps.push({ outcomeCode, missingTypes: missing })
    }
  }

  const allVerified = verifiedCount === outcomes.length
  const noGaps      = contentGaps.length === 0

  return {
    topicId,
    topicTitle:          topic.title,
    totalOutcomes:       outcomes.length,
    mappedOutcomes:      outcomes.length,
    verifiedOutcomes:    verifiedCount,
    contentGaps,
    isCurriculumComplete: allVerified && noGaps,
  }
}

/**
 * Returns true only if every outcome mapped to this topic is:
 *   1. Has all required_content_types published in the DB
 *   2. verification_status = 'verified'
 *
 * Use this before rendering a topic node as "curriculum-complete" on the world map
 * or displaying a curriculum-complete badge on the topic card.
 */
export async function isTopicCurriculumComplete(topicId: string): Promise<boolean> {
  const detail = await getTopicCurriculumCoverage(topicId)
  // A topic with no mapped outcomes is not curriculum-complete
  if (!detail || detail.totalOutcomes === 0) return false
  return detail.isCurriculumComplete
}

/**
 * Returns the list of outcome codes that are missing required content
 * for a given topic. Useful for admin monitoring and parent weak-area reports.
 */
export async function getTopicCurriculumGaps(
  topicId: string,
): Promise<Array<{ outcomeCode: string; missingTypes: string[] }>> {
  const detail = await getTopicCurriculumCoverage(topicId)
  return detail?.contentGaps ?? []
}
