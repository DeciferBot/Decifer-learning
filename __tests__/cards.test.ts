import { describe, it, expect } from 'vitest'
import { pickRarity, rarityForRoundResult } from '@/lib/cards'

describe('pickRarity', () => {
  it('maps the roll onto the documented rarity bands', () => {
    expect(pickRarity(0)).toBe('common')
    expect(pickRarity(39.9)).toBe('common')
    expect(pickRarity(40)).toBe('uncommon')
    expect(pickRarity(64.9)).toBe('uncommon')
    expect(pickRarity(65)).toBe('rare')
    expect(pickRarity(79.9)).toBe('rare')
    expect(pickRarity(80)).toBe('epic')
    expect(pickRarity(89.9)).toBe('epic')
    expect(pickRarity(90)).toBe('legendary')
    expect(pickRarity(99.9)).toBe('legendary')
  })
})

describe('rarityForRoundResult', () => {
  it('rolls the full ladder on a pass', () => {
    expect(rarityForRoundResult(true, 5, 0)).toBe('common')
    expect(rarityForRoundResult(true, 5, 90)).toBe('legendary')
  })

  it('gives a Common card for finishing below the pass mark', () => {
    // The behaviour this whole change exists for: 60 of the 99 attempts on
    // record ended below the mark and every one of them ended with nothing.
    expect(rarityForRoundResult(false, 1)).toBe('common')
    expect(rarityForRoundResult(false, 4)).toBe('common')
  })

  it('never upgrades a miss to a rare card, whatever the roll', () => {
    for (const roll of [0, 25, 50, 75, 99.9]) {
      expect(rarityForRoundResult(false, 3, roll)).toBe('common')
    }
  })

  it('gives nothing when no question was answered correctly', () => {
    // Anti-farm guard: a blank or instantly-abandoned submission earns no card.
    expect(rarityForRoundResult(false, 0)).toBeNull()
  })

  it('still rewards a pass recorded with zero first-try corrects', () => {
    // correctCount only gates the consolation path; a pass always pays.
    expect(rarityForRoundResult(true, 0, 0)).toBe('common')
  })
})
