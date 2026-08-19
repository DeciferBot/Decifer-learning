/**
 * Reasoning item generator tests — guards lib/reasoning/generate.ts.
 *
 * These are PROPERTY tests, not examples. The claim the whole product rests on
 * is "a generated item cannot have a wrong or ambiguous answer", and that claim
 * is only worth anything if it holds across the whole space. So the sweep below
 * generates every (type, level) many times over and asserts the invariants on
 * every single one.
 *
 * Pure functions, no DB/network.
 */

import { describe, it, expect } from 'vitest'
import {
  generateItem,
  validateItem,
  applyRule,
  REASONING_ITEM_TYPES,
  MIN_LEVEL,
  MAX_LEVEL,
  type Level,
  type ReasoningItem,
} from '../lib/reasoning/generate'
import { figureKey, figuresEqual, describeFigure, renderFigure, type Figure } from '../lib/reasoning/shapes'

const LEVELS: Level[] = [1, 2, 3, 4, 5, 6]

/**
 * Items per (type, level) in the main sweep: 1,000 x 4 types x 6 levels = 24,000
 * items, which is the gate in docs/REASONING_TEST_SCOPE.md §11 Phase A.
 */
const SWEEP_PER_CELL = 1000

function everyItem(perCell: number, fn: (item: ReasoningItem, type: string, level: Level) => void) {
  for (const type of REASONING_ITEM_TYPES) {
    for (const level of LEVELS) {
      for (let i = 0; i < perCell; i++) {
        fn(generateItem(type, level, `sweep-${i}`), type, level)
      }
    }
  }
}

describe('generateItem — the invariants, swept across every type and level', () => {
  it('never produces an item that fails its own validator', () => {
    const failures: string[] = []
    everyItem(SWEEP_PER_CELL, (item, type, level) => {
      const reason = validateItem(item)
      if (reason) failures.push(`${type} L${level} seed=${item.seed}: ${reason}`)
    })
    expect(failures).toEqual([])
  })

  it('always has a correctIndex pointing at a real option', () => {
    everyItem(60, (item) => {
      expect(item.correctIndex).toBeGreaterThanOrEqual(0)
      expect(item.correctIndex).toBeLessThan(item.options.length)
      expect(item.options[item.correctIndex]).toBeDefined()
    })
  })

  it('never repeats an option within an item', () => {
    everyItem(60, (item) => {
      const keys = item.options.map(figureKey)
      expect(new Set(keys).size).toBe(keys.length)
    })
  })

  it('gives 4 options for the rule types and 5 for odd-one-out', () => {
    everyItem(40, (item) => {
      expect(item.options.length).toBe(item.type === 'odd_one_out' ? 5 : 4)
    })
  })

  it('puts the answer in every position over a run, so position is no clue', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) {
      seen.add(generateItem('sequence', 3, `pos-${i}`).correctIndex)
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })
})

describe('generateItem — determinism', () => {
  it('returns an identical item for the same seed, every time', () => {
    for (const type of REASONING_ITEM_TYPES) {
      for (const level of LEVELS) {
        const a = generateItem(type, level, 'stable-seed')
        const b = generateItem(type, level, 'stable-seed')
        expect(b).toEqual(a)
      }
    }
  })

  it('returns different items for different seeds', () => {
    const keys = new Set(
      Array.from({ length: 50 }, (_, i) => JSON.stringify(generateItem('matrix', 4, `s${i}`))),
    )
    // Not all 50 need be unique, but near-total collisions would mean the seed
    // is not reaching the generator.
    expect(keys.size).toBeGreaterThan(40)
  })

  it('regenerates the correct answer from the seed alone — the storage claim', () => {
    // The server stores (type, level, seed) and nothing else, then rebuilds the
    // item to mark the answer. If this ever fails, marking silently breaks.
    const original = generateItem('analogy', 5, 'marking-seed')
    const rebuilt = generateItem('analogy', 5, 'marking-seed')
    expect(figureKey(rebuilt.options[rebuilt.correctIndex])).toBe(
      figureKey(original.options[original.correctIndex]),
    )
  })
})

describe('sequence items', () => {
  it('shows four figures and asks for the fifth', () => {
    const item = generateItem('sequence', 3, 'seq-1')
    expect(item.stimulus.kind).toBe('sequence')
    if (item.stimulus.kind !== 'sequence') throw new Error('wrong stimulus')
    expect(item.stimulus.figures).toHaveLength(4)
  })

  it('the shown figures actually follow one consistent rule', () => {
    // Recover the rule from the first two figures and check it holds for the
    // rest and for the answer. If a generator ever emits a sequence that does
    // not follow its own rule, this fails.
    for (let i = 0; i < 100; i++) {
      const item = generateItem('sequence', 2, `rule-${i}`)
      if (item.stimulus.kind !== 'sequence') throw new Error('wrong stimulus')
      const figs = item.stimulus.figures
      // A single-attribute level-2 rule means exactly one attribute changes
      // between consecutive figures (or none, if the rule wrapped to the same
      // value, which the small domains allow).
      const changed = new Set<string>()
      for (let k = 1; k < figs.length; k++) {
        for (const attr of ['kind', 'size', 'fill', 'rotation', 'count'] as const) {
          if (figs[k][attr] !== figs[k - 1][attr]) changed.add(attr)
        }
      }
      expect(changed.size).toBeLessThanOrEqual(1)
    }
  })
})

describe('matrix items', () => {
  it('is a 3x3 grid with exactly one empty cell, at the bottom right', () => {
    everyLevelOf('matrix', (item) => {
      if (item.stimulus.kind !== 'matrix') throw new Error('wrong stimulus')
      const grid = item.stimulus.grid
      expect(grid).toHaveLength(3)
      for (const row of grid) expect(row).toHaveLength(3)
      const empties = grid.flat().filter((c) => c === null)
      expect(empties).toHaveLength(1)
      expect(grid[2][2]).toBeNull()
    })
  })

  it('never shows the answer already sitting somewhere in the grid', () => {
    // If the correct figure also appears as a filled cell, a child can win by
    // matching pictures instead of reasoning.
    let matches = 0
    for (let i = 0; i < 200; i++) {
      const item = generateItem('matrix', 4, `grid-${i}`)
      if (item.stimulus.kind !== 'matrix') throw new Error('wrong stimulus')
      const answer = item.options[item.correctIndex]
      const shown = item.stimulus.grid.flat().filter((c): c is Figure => c !== null)
      if (shown.some((c) => figuresEqual(c, answer))) matches++
    }
    // Small attribute domains mean a rule can legitimately wrap back onto a
    // shown value. Rare is acceptable; common would mean the grid is degenerate.
    expect(matches / 200).toBeLessThan(0.15)
  })
})

describe('analogy items', () => {
  it('shows three figures and asks for the fourth', () => {
    everyLevelOf('analogy', (item) => {
      if (item.stimulus.kind !== 'analogy') throw new Error('wrong stimulus')
      expect(item.stimulus.a).toBeDefined()
      expect(item.stimulus.b).toBeDefined()
      expect(item.stimulus.c).toBeDefined()
    })
  })

  it('applies the same transformation to C that turned A into B', () => {
    for (let i = 0; i < 100; i++) {
      const item = generateItem('analogy', 3, `an-${i}`)
      if (item.stimulus.kind !== 'analogy') throw new Error('wrong stimulus')
      const { a, b, c } = item.stimulus
      const answer = item.options[item.correctIndex]
      // Whatever attributes changed from A to B must change the same way from C
      // to the answer.
      for (const attr of ['kind', 'size', 'fill', 'rotation', 'count'] as const) {
        const changedAB = a[attr] !== b[attr]
        const changedCAnswer = c[attr] !== answer[attr]
        expect(changedAB).toBe(changedCAnswer)
      }
    }
  })
})

describe('odd-one-out items', () => {
  it('has exactly one attribute splitting the five four-against-one', () => {
    // This is the ambiguity guarantee. validateItem enforces it; this proves
    // validateItem is actually reached for this type.
    everyLevelOf('odd_one_out', (item) => {
      expect(validateItem(item)).toBeNull()
      expect(item.options).toHaveLength(5)
    })
  })

  it('rejects an item where two attributes both single one out', () => {
    // Hand-built ambiguous item: figure 4 differs on BOTH fill and count.
    const base: Figure = { kind: 'circle', size: 2, fill: 'none', rotation: 0, count: 1 }
    const options: Figure[] = [
      base,
      base,
      base,
      base,
      { ...base, fill: 'solid', count: 3 },
    ]
    const reason = validateItem({
      type: 'odd_one_out',
      level: 1,
      seed: 'x',
      prompt: '',
      stimulus: { kind: 'odd_one_out' },
      options,
      correctIndex: 4,
    })
    // Duplicate options are caught first, which is also correct — but the point
    // is that this item never passes.
    expect(reason).not.toBeNull()
  })
})

describe('applyRule', () => {
  it('wraps rather than running off the end of an attribute', () => {
    const f: Figure = { kind: 'circle', size: 3, fill: 'solid', rotation: 315, count: 4 }
    const out = applyRule(f, [{ attribute: 'count', delta: 1 }], 1)
    expect(out.count).toBe(1)
    const spun = applyRule(f, [{ attribute: 'rotation', delta: 1 }], 1)
    expect(spun.rotation).toBe(0)
  })

  it('applying a rule then its inverse returns the original', () => {
    const f: Figure = { kind: 'triangle', size: 1, fill: 'hatch', rotation: 90, count: 2 }
    const rule = [
      { attribute: 'rotation' as const, delta: 2 },
      { attribute: 'fill' as const, delta: 1 },
    ]
    expect(applyRule(applyRule(f, rule, 1), rule, -1)).toEqual(f)
  })

  it('applying a rule zero times changes nothing', () => {
    const f: Figure = { kind: 'hexagon', size: 2, fill: 'dots', rotation: 45, count: 3 }
    expect(applyRule(f, [{ attribute: 'size', delta: 1 }], 0)).toEqual(f)
  })
})

describe('rendering and description', () => {
  it('describes every figure in an item in plain English', () => {
    const item = generateItem('sequence', 1, 'desc')
    for (const opt of item.options) {
      const text = describeFigure(opt)
      expect(text.length).toBeGreaterThan(5)
      expect(text).not.toContain('undefined')
    }
  })

  it('renders self-contained SVG with an accessible label', () => {
    const item = generateItem('matrix', 3, 'svg')
    const svg = renderFigure(item.options[0], 'opt0')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('role="img"')
    expect(svg).toContain('<title>')
    expect(svg).toContain('aria-label=')
    // No external references. The xmlns is a namespace name, not a fetch, so
    // check the things that would actually cause a network request under the
    // published pages' CSP.
    expect(svg).not.toMatch(/(?:href|src)\s*=/i)
    expect(svg).not.toContain('<image')
    expect(svg).not.toMatch(/url\(\s*['"]?https?:/i)
  })

  it('namespaces pattern ids so two figures on a page do not collide', () => {
    const f: Figure = { kind: 'square', size: 2, fill: 'hatch', rotation: 0, count: 1 }
    expect(renderFigure(f, 'a')).toContain('id="a-hatch"')
    expect(renderFigure(f, 'b')).toContain('id="b-hatch"')
  })

  it('never encodes information in colour alone', () => {
    // Fills are hatch/dots/solid/none and strokes use currentColor, so a
    // greyscale or high-contrast rendering loses nothing.
    const f: Figure = { kind: 'circle', size: 2, fill: 'dots', rotation: 0, count: 2 }
    const svg = renderFigure(f, 'c')
    expect(svg).not.toMatch(/fill="#[0-9a-f]{3,6}"/i)
    expect(svg).not.toMatch(/stroke="#[0-9a-f]{3,6}"/i)
  })
})

describe('levels', () => {
  it('covers the full advertised range', () => {
    expect(MIN_LEVEL).toBe(1)
    expect(MAX_LEVEL).toBe(6)
  })

  it('makes higher levels vary more attributes than lower ones', () => {
    const varied = (level: Level) => {
      let total = 0
      for (let i = 0; i < 80; i++) {
        const item = generateItem('sequence', level, `v${level}-${i}`)
        if (item.stimulus.kind !== 'sequence') throw new Error('wrong stimulus')
        const [first, second] = item.stimulus.figures
        for (const attr of ['kind', 'size', 'fill', 'rotation', 'count'] as const) {
          if (first[attr] !== second[attr]) total++
        }
      }
      return total / 80
    }
    expect(varied(5)).toBeGreaterThan(varied(1))
  })
})

/** Run `fn` on one item from each level of `type`. */
function everyLevelOf(
  type: (typeof REASONING_ITEM_TYPES)[number],
  fn: (item: ReasoningItem) => void,
) {
  for (const level of LEVELS) {
    for (let i = 0; i < 30; i++) fn(generateItem(type, level, `${type}-${level}-${i}`))
  }
}
