export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

// Cumulative thresholds — roll is [0, 100)
const RARITY_THRESHOLDS: [Rarity, number][] = [
  ['common',    40],
  ['uncommon',  65],
  ['rare',      80],
  ['epic',      90],
  ['legendary', 100],
]

export function pickRarity(roll = Math.random() * 100): Rarity {
  for (const [rarity, threshold] of RARITY_THRESHOLDS) {
    if (roll < threshold) return rarity
  }
  return 'legendary'
}

/**
 * Which card, if any, a finished quiz round earns.
 *
 * A pass rolls the full rarity ladder. A round that finishes below the pass mark
 * still earns a Common card, so a child never walks away from a round with
 * nothing: 60 of the 99 attempts on record ended below the mark and every one of
 * them ended on an empty result screen. At least one correct answer is required,
 * so an instantly-abandoned or blank submission cannot farm cards.
 *
 * PURE: the caller supplies the roll, so this is deterministic under test.
 */
export function rarityForRoundResult(
  passed: boolean,
  correctCount: number,
  roll = Math.random() * 100,
): Rarity | null {
  if (passed) return pickRarity(roll)
  if (correctCount > 0) return 'common'
  return null
}

export const RARITY_COLOUR: Record<Rarity, string> = {
  common:    '#A8E6CF',
  uncommon:  '#74C0FC',
  rare:      '#FFD43B',
  epic:      '#CC5DE8',
  legendary: '#FFA94D',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common:    'Common',
  uncommon:  'Uncommon',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
}

/** @deprecated Use RARITY_ICON from components/ui/icons instead */
export const RARITY_EMOJI: Record<Rarity, string> = {
  common:    '🌿',
  uncommon:  '💧',
  rare:      '⭐',
  epic:      '💎',
  legendary: '🌟',
}

export const RARITY_ICON_NAME: Record<Rarity, string> = {
  common:    'Leaf',
  uncommon:  'Compass',
  rare:      'Star',
  epic:      'Gem',
  legendary: 'Crown',
}
