import { describe, it, expect } from 'vitest'
import {
  BOARD_SIZE, CENTER, PREMIUM_LAYOUT, TILE_DISTRIBUTION, LETTER_VALUES,
  createTileBag, drawTiles, letterValue,
} from '../lib/games/scrabble-board'

describe('PREMIUM_LAYOUT', () => {
  it('matches the published standard counts (8 TW, 17 DW, 12 TL, 24 DL)', () => {
    let tw = 0, dw = 0, tl = 0, dl = 0
    for (const row of PREMIUM_LAYOUT) {
      for (const cell of row) {
        if (cell === 'TW') tw++
        else if (cell === 'DW') dw++
        else if (cell === 'TL') tl++
        else if (cell === 'DL') dl++
      }
    }
    expect(tw).toBe(8)
    expect(dw).toBe(17)
    expect(tl).toBe(12)
    expect(dl).toBe(24)
    expect(tw + dw + tl + dl).toBe(61)
  })

  it('is a full 15x15 grid', () => {
    expect(PREMIUM_LAYOUT).toHaveLength(BOARD_SIZE)
    for (const row of PREMIUM_LAYOUT) expect(row).toHaveLength(BOARD_SIZE)
  })

  it('the centre square is the double-word star', () => {
    expect(PREMIUM_LAYOUT[CENTER][CENTER]).toBe('DW')
  })

  it('all four corners are triple-word squares', () => {
    expect(PREMIUM_LAYOUT[0][0]).toBe('TW')
    expect(PREMIUM_LAYOUT[0][14]).toBe('TW')
    expect(PREMIUM_LAYOUT[14][0]).toBe('TW')
    expect(PREMIUM_LAYOUT[14][14]).toBe('TW')
  })

  it('is symmetric under both horizontal and vertical mirroring', () => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(PREMIUM_LAYOUT[r][c]).toBe(PREMIUM_LAYOUT[r][BOARD_SIZE - 1 - c])
        expect(PREMIUM_LAYOUT[r][c]).toBe(PREMIUM_LAYOUT[BOARD_SIZE - 1 - r][c])
      }
    }
  })
})

describe('tile distribution', () => {
  it('totals exactly 100 tiles', () => {
    const total = Object.values(TILE_DISTRIBUTION).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('E is the most common letter and blanks total 2', () => {
    expect(TILE_DISTRIBUTION.E).toBe(12)
    expect(TILE_DISTRIBUTION._).toBe(2)
  })

  it('Q, J, X, Z are the rarest at 1 tile each, worth 8 or 10 points', () => {
    for (const rare of ['Q', 'J', 'X', 'Z']) {
      expect(TILE_DISTRIBUTION[rare]).toBe(1)
    }
    expect(LETTER_VALUES.J).toBe(8)
    expect(LETTER_VALUES.X).toBe(8)
    expect(LETTER_VALUES.Q).toBe(10)
    expect(LETTER_VALUES.Z).toBe(10)
  })

  it('every distributed letter has a defined value, and blanks are worth 0', () => {
    for (const letter of Object.keys(TILE_DISTRIBUTION)) {
      expect(LETTER_VALUES[letter]).toBeDefined()
    }
    expect(letterValue('_')).toBe(0)
    expect(letterValue('a')).toBe(1) // case-insensitive
  })
})

describe('createTileBag / drawTiles', () => {
  it('creates exactly 100 tiles matching the distribution', () => {
    const bag = createTileBag()
    expect(bag).toHaveLength(100)
    const counts: Record<string, number> = {}
    for (const t of bag) counts[t] = (counts[t] ?? 0) + 1
    expect(counts).toEqual(TILE_DISTRIBUTION)
  })

  it('draws the requested count and shrinks the bag', () => {
    const bag = createTileBag()
    const drawn = drawTiles(bag, 7)
    expect(drawn).toHaveLength(7)
    expect(bag).toHaveLength(93)
  })

  it('draws fewer tiles than requested when the bag runs low, without erroring', () => {
    const bag = createTileBag()
    drawTiles(bag, 97)
    expect(bag).toHaveLength(3)
    const last = drawTiles(bag, 10)
    expect(last).toHaveLength(3)
    expect(bag).toHaveLength(0)
    expect(drawTiles(bag, 5)).toHaveLength(0)
  })

  it('shuffles — two freshly created bags are not identically ordered', () => {
    const a = createTileBag()
    const b = createTileBag()
    expect(a).not.toEqual(b)
  })
})
