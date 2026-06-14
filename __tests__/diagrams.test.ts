/**
 * Diagram registry coverage — guards the inline-SVG library that powers the
 * `drag_label` and `diagram` Learn widgets (CLAUDE.md §10 game mechanics).
 *
 * Contract: every DiagramType declared in lib/learn-widgets.ts must be wired in
 * the registry — both a `case` in getDiagramSvg and an aspect-ratio entry — so a
 * type can never be added to the union yet silently fall through to the
 * placeholder box in front of children.
 *
 * Source-text based on purpose: the registry is a .tsx module and this repo's
 * Vitest setup has no JSX transformer, so importing it into a node test would
 * fail. Reading the source ties the union directly to its implementation, which
 * is exactly the parity we want to enforce.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')
const widgetsSrc = readFileSync(resolve(root, 'lib/learn-widgets.ts'), 'utf8')
const registrySrc = readFileSync(resolve(root, 'components/learn/diagrams/index.tsx'), 'utf8')

/** Pull the string-literal members of the `export type DiagramType = ...` union. */
function diagramTypeUnion(src: string): string[] {
  const start = src.indexOf('export type DiagramType')
  expect(start, 'DiagramType union not found in lib/learn-widgets.ts').toBeGreaterThan(-1)
  const rest = src.slice(start)
  const end = rest.indexOf('export', 1) // next export terminates the union block
  const block = end > -1 ? rest.slice(0, end) : rest
  return [...block.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1])
}

const TYPES = diagramTypeUnion(widgetsSrc)

describe('diagram registry', () => {
  it('parses a non-trivial DiagramType union', () => {
    expect(TYPES.length).toBeGreaterThanOrEqual(20)
    expect(new Set(TYPES).size).toBe(TYPES.length) // no duplicates
  })

  it('wires every DiagramType to a getDiagramSvg case', () => {
    for (const type of TYPES) {
      expect(
        registrySrc.includes(`case '${type}':`),
        `diagram_type "${type}" has no case in getDiagramSvg — it would hit the placeholder`
      ).toBe(true)
    }
  })

  it('gives every DiagramType an aspect-ratio entry', () => {
    // Matches `  circle: 100,` style keys inside DIAGRAM_ASPECT_RATIO.
    for (const type of TYPES) {
      expect(
        new RegExp(`\\b${type}:\\s*\\d`).test(registrySrc),
        `diagram_type "${type}" is missing a DIAGRAM_ASPECT_RATIO entry`
      ).toBe(true)
    }
  })

  it('keeps the original 7 diagrams', () => {
    for (const original of [
      'circle',
      'triangle',
      'plant',
      'animal_cell',
      'water_cycle',
      'multiplication_groups',
      'bar_model',
    ]) {
      expect(TYPES).toContain(original)
    }
  })
})
