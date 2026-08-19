import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { capturedMaterial } from '@/lib/games/chess-material'
import { THUMB_RADIUS, safeStep, ticksFor, valueToX } from '@/lib/games/number-line'

describe('capturedMaterial', () => {
  it('reports nothing captured at the start', () => {
    const { white, black } = capturedMaterial(new Chess().fen())
    expect(white).toEqual([])
    expect(black).toEqual([])
  })

  it('counts a captured piece', () => {
    const g = new Chess()
    g.move('e4'); g.move('d5'); g.move('exd5')
    const { black } = capturedMaterial(g.fen())
    expect(black).toEqual(['p'])
  })

  it('survives a promotion', () => {
    // The regression this exists for. This game always promotes to a queen, so
    // White ends up with two. 1 - 2 = -1 queens "captured", and Array(-1)
    // throws RangeError, which took the whole board down with it.
    const twoQueens = '4k3/8/8/8/8/8/8/3QQ2K w - - 0 1'
    expect(() => capturedMaterial(twoQueens)).not.toThrow()
    const { white } = capturedMaterial(twoQueens)
    expect(white).not.toContain('q')
    expect(white.filter((p) => p === 'p')).toHaveLength(8)
  })

  it('never reports a negative count for any piece', () => {
    // Four extra queens and no pawns: every count must clamp at zero.
    const absurd = 'qqqqk3/8/8/8/8/8/8/QQQQK3 w - - 0 1'
    const { white, black } = capturedMaterial(absurd)
    for (const side of [white, black]) {
      expect(side).not.toContain('q')
      expect(side.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('ignores kings, which can never be captured', () => {
    const { white, black } = capturedMaterial('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(white).not.toContain('k')
    expect(black).not.toContain('k')
  })
})

describe('safeStep', () => {
  it('keeps a sensible step', () => {
    expect(safeStep(1, 0, 20)).toBe(1)
    expect(safeStep(0.5, 0, 10)).toBe(0.5)
  })

  it('refuses a step that would never terminate', () => {
    // config_json is untrusted. `for (v = min; v <= max; v += 0)` hangs the tab.
    expect(safeStep(0, 0, 20)).toBe(1)
    expect(safeStep(-2, 0, 20)).toBe(1)
    expect(safeStep(NaN, 0, 20)).toBe(1)
    expect(safeStep(Infinity, 0, 20)).toBe(1)
  })

  it('coarsens a step that would paint thousands of ticks', () => {
    const step = safeStep(0.001, 0, 100)
    expect(100 / step).toBeLessThanOrEqual(200)
  })
})

describe('ticksFor', () => {
  it('covers min to max inclusive', () => {
    const ticks = ticksFor(0, 10, 1)
    expect(ticks).toHaveLength(11)
    expect(ticks[0].v).toBe(0)
    expect(ticks[ticks.length - 1].v).toBe(10)
  })

  it('marks every fifth tick, and always the last one', () => {
    const ticks = ticksFor(0, 20, 1)
    expect(ticks.filter((t) => t.isMajor).map((t) => t.v)).toEqual([0, 5, 10, 15, 20])
  })

  it('still produces numbered ticks on a fractional step', () => {
    // Accumulating `v += 0.5` drifted to 2.4999999998, so the old
    // `v % (step * 5) === 0` test matched nothing and the line lost its labels.
    const ticks = ticksFor(0, 5, 0.5)
    expect(ticks.map((t) => t.v)).toContain(2.5)
    expect(ticks.filter((t) => t.isMajor).length).toBeGreaterThan(1)
  })

  it('terminates on a hostile config', () => {
    expect(ticksFor(0, 10, 0).length).toBeGreaterThan(0)
    expect(ticksFor(5, 5, 1)).toHaveLength(1)
  })
})

describe('valueToX', () => {
  const WIDTH = 400

  it('insets by half a handle at each end, matching a native range input', () => {
    expect(valueToX(0, 0, 10, WIDTH)).toBe(THUMB_RADIUS)
    expect(valueToX(10, 0, 10, WIDTH)).toBe(WIDTH - THUMB_RADIUS)
  })

  it('puts the midpoint in the middle', () => {
    expect(valueToX(5, 0, 10, WIDTH)).toBeCloseTo(WIDTH / 2, 6)
  })

  it('never lets the handle hang off the track', () => {
    for (const v of [-100, 0, 3, 10, 999]) {
      const x = valueToX(v, 0, 10, WIDTH)
      expect(x).toBeGreaterThanOrEqual(THUMB_RADIUS)
      expect(x).toBeLessThanOrEqual(WIDTH - THUMB_RADIUS)
    }
  })

  it('does not divide by zero on a degenerate range or an unmeasured track', () => {
    expect(Number.isFinite(valueToX(5, 5, 5, WIDTH))).toBe(true)
    expect(Number.isFinite(valueToX(5, 0, 10, 0))).toBe(true)
  })
})
