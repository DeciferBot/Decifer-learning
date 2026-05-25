/**
 * Reward Vault Stage 4 — Smart reward suggestions.
 *
 * Uses PLI learning signals to surface catalogue items that might
 * motivate a child based on their recent learning activity.
 *
 * SAFETY: parent-facing only. Never import from child routes.
 * SAFETY: returns only id, name, category — never price_pence.
 */

import { prisma } from '@/lib/prisma'
import { getSignalsForChild } from '@/lib/learning-signals-runner'

export interface RewardSuggestion {
  catalogueItemId: string
  name: string
  category: string | null
  reason: string
  signalBasis: 'lower_accuracy' | 'high_effort' | 'persistence' | 'interest' | 'mastery' | 'general'
}

// Subject name keywords → catalogue categories most likely to motivate in that subject
const SUBJECT_TO_CATEGORIES: Array<{ keywords: string[]; categories: string[] }> = [
  { keywords: ['maths', 'math', 'number', 'algebra', 'geometry'],  categories: ['Games', 'Science'] },
  { keywords: ['science', 'biology', 'physics', 'chemistry'],      categories: ['Science', 'Books'] },
  { keywords: ['english', 'reading', 'writing', 'literacy'],       categories: ['Books', 'Stationery', 'Art'] },
]

function subjectToCategories(subjectName: string): string[] {
  const lower = subjectName.toLowerCase()
  for (const mapping of SUBJECT_TO_CATEGORIES) {
    if (mapping.keywords.some((k) => lower.includes(k))) {
      return mapping.categories
    }
  }
  return []
}

/**
 * Returns up to 3 reward suggestions for a child.
 *
 * Priority:
 *   1. Items linked to subjects where the child has lower-accuracy signals
 *   2. Items linked to subjects where the child shows interest / mastery
 *   3. Experience rewards as general motivation fill
 *   4. Any remaining active items
 */
export async function getRewardSuggestions(
  childProfileId: string,
): Promise<RewardSuggestion[]> {
  const [catalogue, signals] = await Promise.all([
    prisma.rewardCatalog.findMany({
      where:   { is_active: true },
      select:  { id: true, name: true, category: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    getSignalsForChild(childProfileId),
  ])

  if (catalogue.length === 0) return []

  // Look up subject names for all signal subject IDs (deduplicated)
  const subjectIds = [...new Set(signals.map((s) => s.subjectId).filter(Boolean) as string[])]
  const subjectRows = subjectIds.length > 0
    ? await prisma.subject.findMany({
        where:  { id: { in: subjectIds } },
        select: { id: true, name: true },
      })
    : []
  const subjectNameById = new Map(subjectRows.map((s) => [s.id, s.name]))

  const suggestions: RewardSuggestion[] = []
  const usedItemIds = new Set<string>()

  function pickItem(categories: string[]): (typeof catalogue)[0] | null {
    for (const cat of categories) {
      const item = catalogue.find(
        (c) => c.category?.toLowerCase() === cat.toLowerCase() && !usedItemIds.has(c.id),
      )
      if (item) return item
    }
    return null
  }

  function addSuggestion(
    item: (typeof catalogue)[0],
    reason: string,
    basis: RewardSuggestion['signalBasis'],
  ) {
    usedItemIds.add(item.id)
    suggestions.push({ catalogueItemId: item.id, name: item.name, category: item.category, reason, signalBasis: basis })
  }

  // ── Priority 1: weak-area signals ────────────────────────────────────────────
  const weakSignals = signals.filter((s) =>
    ['lower_accuracy', 'high_effort_low_progress', 'repeated_without_progress'].includes(s.signalType),
  )

  for (const sig of weakSignals) {
    if (suggestions.length >= 3) break
    if (!sig.subjectId) continue
    const subjectName = subjectNameById.get(sig.subjectId) ?? ''
    const cats = subjectToCategories(subjectName)
    const item = pickItem(cats)
    if (item) {
      addSuggestion(
        item,
        `${subjectName ? subjectName + ' is' : 'This area is'} taking more effort — a reward can help sustain motivation.`,
        'lower_accuracy',
      )
    }
  }

  // ── Priority 2: interest / mastery signals ────────────────────────────────────
  const positiveSignals = signals.filter((s) =>
    ['interest_signal', 'mastery', 'quick_success', 'persistence'].includes(s.signalType),
  )

  for (const sig of positiveSignals) {
    if (suggestions.length >= 3) break
    if (!sig.subjectId) continue
    const subjectName = subjectNameById.get(sig.subjectId) ?? ''
    const cats = subjectToCategories(subjectName)
    const item = pickItem(cats)
    if (item) {
      const verb = sig.signalType === 'mastery' || sig.signalType === 'quick_success'
        ? 'Good progress in'
        : 'Keeping up with'
      addSuggestion(
        item,
        `${verb} ${subjectName || 'their learning'} — a reward to celebrate the effort.`,
        sig.signalType === 'persistence' ? 'persistence' : 'interest',
      )
    }
  }

  // ── Priority 3: experience rewards (general motivation) ──────────────────────
  if (suggestions.length < 3) {
    const experiences = catalogue.filter(
      (c) => c.category?.toLowerCase() === 'experiences' && !usedItemIds.has(c.id),
    )
    for (const item of experiences) {
      if (suggestions.length >= 3) break
      addSuggestion(item, 'A treat to celebrate the learning journey.', 'general')
    }
  }

  // ── Priority 4: fill with any remaining items ────────────────────────────────
  for (const item of catalogue) {
    if (suggestions.length >= 3) break
    if (usedItemIds.has(item.id)) continue
    addSuggestion(item, 'A reward to recognise their ongoing effort.', 'general')
  }

  return suggestions
}
