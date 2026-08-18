import { describe, it, expect } from 'vitest'
import { isValidWord } from '../lib/games/scrabble-dictionary'

describe('isValidWord', () => {
  it('accepts common English words, case-insensitively', () => {
    expect(isValidWord('CAT')).toBe(true)
    expect(isValidWord('cat')).toBe(true)
    expect(isValidWord('Elephant')).toBe(true)
    expect(isValidWord('QUIZ')).toBe(true)
  })

  it('accepts real short words used often in word-tile games', () => {
    for (const w of ['AT', 'BE', 'OX', 'ZA', 'QI']) {
      expect(isValidWord(w)).toBe(true)
    }
  })

  it('rejects gibberish and single letters', () => {
    expect(isValidWord('ZZXQ')).toBe(false)
    expect(isValidWord('QQQQ')).toBe(false)
    expect(isValidWord('A')).toBe(false)
  })

  it('loaded a real, large dictionary rather than an empty/corrupt file', () => {
    // Spot-check breadth across the alphabet rather than trusting one word.
    const samples = ['APPLE', 'BANANA', 'GALAXY', 'OCTOPUS', 'ZEBRA', 'YELLOW', 'JUNGLE']
    for (const w of samples) expect(isValidWord(w)).toBe(true)
  })
})
