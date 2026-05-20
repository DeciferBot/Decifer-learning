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

export const RARITY_EMOJI: Record<Rarity, string> = {
  common:    '🌿',
  uncommon:  '💧',
  rare:      '⭐',
  epic:      '💎',
  legendary: '🌟',
}
