/**
 * ChessPieceArt renders through react-dom/server here because the artwork is
 * inert markup — no hooks, no state — and the failure modes worth guarding
 * are all visible in the markup itself: a piece variant that renders empty,
 * or a fill/stroke that slipped back to a literal colour instead of a
 * tokens.css §14 variable (the rhosgfx source SVGs are hard-coded warm
 * browns and creams, so a careless re-import would reintroduce them, ignore
 * the board's palette, and on the dark board make the pieces disappear).
 *
 * The source files also colour themselves through a <style> block with
 * generic `.cls-1` class names. Those selectors are document-wide once the
 * SVG is inlined, so the import strips them; the class check below is what
 * stops one creeping back in and repainting the rest of the page.
 */

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChessPieceArt, type PieceColour, type PieceType } from '@/components/games/ChessPieceArt'

const COLOURS: PieceColour[] = ['w', 'b']
const TYPES: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k']

function render(colour: PieceColour, type: PieceType): string {
  return renderToStaticMarkup(createElement(ChessPieceArt, { colour, type }))
}

describe('ChessPieceArt', () => {
  it('renders drawable artwork for all twelve pieces', () => {
    for (const colour of COLOURS) {
      for (const type of TYPES) {
        const svg = render(colour, type)
        expect(svg, `${colour}${type}`).toContain('viewBox="0 0 72 72"')
        expect(svg, `${colour}${type}`).toContain('<path')
      }
    }
  })

  it('colours every piece with tokens, never literal colours', () => {
    for (const colour of COLOURS) {
      for (const type of TYPES) {
        const svg = render(colour, type)
        expect(svg, `${colour}${type}`).not.toMatch(/#[0-9a-fA-F]{3,6}/)
        expect(svg, `${colour}${type}`).toContain(
          colour === 'w' ? 'var(--game-piece-light)' : 'var(--game-piece-dark)',
        )
      }
    }
  })

  it('gives each side its own fill and the opposite side\'s rim', () => {
    // The §14 contrast rule: light pieces never lean on dark-piece tokens
    // and vice versa, so the two sides can never render alike.
    for (const type of TYPES) {
      expect(render('w', type)).not.toContain('--game-piece-dark')
      expect(render('b', type)).not.toContain('--game-piece-light')
    }
  })

  it('carries no class or <style>, which would leak out of the SVG', () => {
    for (const colour of COLOURS) {
      for (const type of TYPES) {
        const svg = render(colour, type)
        expect(svg, `${colour}${type}`).not.toContain('class=')
        expect(svg, `${colour}${type}`).not.toContain('<style')
      }
    }
  })

  it('is hidden from the accessibility tree (squares carry the labels)', () => {
    expect(render('w', 'k')).toContain('aria-hidden="true"')
  })
})
