import { describe, it, expect } from 'vitest'
import { contrastRatio, inkOn, onPaper, tint } from '@/lib/subject-colour'

// The five curriculum subjects as they are stored in subjects.colour_token.
const SUBJECTS = {
  maths: '#6C9EFF',
  english: '#FF8FAB',
  science: '#52D9A0',
  history: '#C084FC',
  geography: '#15788C',
}

const AA = 4.5

describe('contrastRatio', () => {
  it('matches the WCAG reference values at the extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
  })

  it('is order independent', () => {
    expect(contrastRatio('#15788C', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#15788C'), 10)
  })

  it('reports 0 for an unreadable colour rather than a misleading number', () => {
    // NaN used to propagate here, and NaN fails every comparison, which is how
    // an unparseable value ended up being treated as "safe".
    expect(contrastRatio('not-a-colour', '#FFFFFF')).toBe(0)
    expect(contrastRatio('', '#FFFFFF')).toBe(0)
  })
})

describe('inkOn', () => {
  it('gives every subject badge at least AA', () => {
    for (const [name, colour] of Object.entries(SUBJECTS)) {
      const ink = inkOn(colour)
      expect(contrastRatio(ink, colour), `${name} (${colour})`).toBeGreaterThanOrEqual(AA)
    }
  })

  it('picks dark ink on the light subjects and white on the dark one', () => {
    expect(inkOn(SUBJECTS.maths)).toBe('#1F1A14')
    expect(inkOn(SUBJECTS.english)).toBe('#1F1A14')
    expect(inkOn(SUBJECTS.science)).toBe('#1F1A14')
    // Geography is dark enough that white is the readable choice.
    expect(inkOn(SUBJECTS.geography)).toBe('#FFFFFF')
  })

  it('falls back to ink, never white, for a value it cannot read', () => {
    // Every surface in this product is light. White on an unknown light card
    // is invisible; dark ink on one is merely imperfect.
    for (const bad of ['', 'red', 'rgb(1,2,3)', '#GGGGGG', '#12', 'null']) {
      expect(inkOn(bad), bad).toBe('#1F1A14')
    }
  })

  it('accepts shorthand hex and stray whitespace', () => {
    expect(inkOn('#fff')).toBe('#1F1A14')
    expect(inkOn('  #15788C ')).toBe('#FFFFFF')
  })
})

describe('onPaper', () => {
  it('darkens a subject colour until it is readable as text', () => {
    for (const [name, colour] of Object.entries(SUBJECTS)) {
      const ink = onPaper(colour)
      expect(contrastRatio(ink, '#FFFFFF'), `${name} (${colour})`).toBeGreaterThanOrEqual(AA)
    }
  })

  it('leaves a colour alone when it already passes', () => {
    expect(onPaper('#15788C')).toBe('#15788C')
  })

  it('honours a non-white surface', () => {
    const onWarmPaper = onPaper(SUBJECTS.maths, '#FDF8F2')
    expect(contrastRatio(onWarmPaper, '#FDF8F2')).toBeGreaterThanOrEqual(AA)
  })

  it('returns ink for a value it cannot read', () => {
    expect(onPaper('nonsense')).toBe('#1F1A14')
  })
})

describe('tint', () => {
  it('composites the way the browser does', () => {
    expect(tint('#000000', '#FFFFFF', 0.5)).toBe('#808080')
    expect(tint('#FF0000', '#FFFFFF', 0)).toBe('#ffffff')
    expect(tint('#FF0000', '#FFFFFF', 1)).toBe('#ff0000')
  })

  it('clamps an out-of-range alpha instead of producing an invalid channel', () => {
    expect(tint('#FF0000', '#FFFFFF', 5)).toBe('#ff0000')
    expect(tint('#FF0000', '#FFFFFF', -2)).toBe('#ffffff')
  })

  it('produces a tint that its own onPaper result stays readable against', () => {
    // This is the pairing the Learning Journey chips rely on.
    for (const colour of Object.values(SUBJECTS)) {
      const bg = tint(colour, '#FDF8F2', 0.1)
      expect(contrastRatio(onPaper(colour, bg), bg)).toBeGreaterThanOrEqual(AA)
    }
  })

  it('falls back to the surface when the colour is unreadable', () => {
    // Note "bad" is deliberately NOT used here: b, a and d are all hex digits,
    // so it parses as #bbaadd. Shorthand hex swallows more typos than it looks.
    expect(tint('teal', '#FDF8F2', 0.1)).toBe('#FDF8F2')
    expect(tint('', '#FDF8F2', 0.1)).toBe('#FDF8F2')
  })
})
