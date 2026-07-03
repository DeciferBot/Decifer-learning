/**
 * MathText splitting — guards against raw `$$...$$` LaTeX delimiters leaking
 * into child-facing question/card text unrendered.
 *
 * Regression pin: the "Try It" widget on topic pages once rendered
 * `In the expression $$4x+2y-5+x^2$$ there are four ____` literally, because
 * PreTestShell.tsx interpolated question_text without going through MathText.
 * That call site is fixed, but this test guards the underlying parser so any
 * future call site (fixed or new) that *does* route through MathText behaves
 * correctly for every delimiter shape the content pipeline produces.
 */

import { describe, it, expect } from 'vitest'
import { splitMath } from '../components/ui/mathParse'

describe('splitMath', () => {
  it('extracts a $$...$$ display expression embedded mid-sentence', () => {
    const parts = splitMath('In the expression $$4x+2y-5+x^2$$ there are four ____')
    expect(parts).toEqual([
      { type: 'text', value: 'In the expression ' },
      { type: 'math', value: '4x+2y-5+x^2' },
      { type: 'text', value: ' there are four ____' },
    ])
    // No raw delimiter should ever survive into a rendered part's value.
    for (const part of parts) {
      expect(part.value).not.toMatch(/\$\$/)
    }
  })

  it('extracts a single-dollar inline expression', () => {
    const parts = splitMath('Solve for $x$ in the equation')
    expect(parts.some((p) => p.type === 'math' && p.value === 'x')).toBe(true)
  })

  it('does not treat two independent currency amounts as one math span', () => {
    const original = 'The book costs $5 and the pen costs $2'
    const parts = splitMath(original)
    // No part should be classified as math — this is prose, not LaTeX.
    expect(parts.every((p) => p.type === 'text')).toBe(true)
    // Splitting is lossless: concatenating every part reconstructs the original.
    expect(parts.map((p) => p.value).join('')).toBe(original)
  })

  it('extracts \\(...\\) delimited expressions', () => {
    const parts = splitMath('Simplify \\(3x + 2\\) fully')
    expect(parts.some((p) => p.type === 'math' && p.value === '3x + 2')).toBe(true)
  })

  it('detects bare LaTeX commands outside any delimiter', () => {
    const parts = splitMath('Convert -5^\\circ \\text{C} to Fahrenheit')
    expect(parts.some((p) => p.type === 'math')).toBe(true)
  })

  it('returns plain text unchanged when no math is present', () => {
    expect(splitMath('There are four terms')).toEqual([
      { type: 'text', value: 'There are four terms' },
    ])
  })

  it('handles multiple $$...$$ expressions in one string', () => {
    const parts = splitMath('$$x+1$$ equals $$y-1$$ when balanced')
    const mathParts = parts.filter((p) => p.type === 'math').map((p) => p.value)
    expect(mathParts).toEqual(['x+1', 'y-1'])
  })

  it('handles an empty string without throwing', () => {
    expect(splitMath('')).toEqual([{ type: 'text', value: '' }])
  })
})
