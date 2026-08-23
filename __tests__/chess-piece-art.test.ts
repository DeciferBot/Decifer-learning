/**
 * ChessPieceArt renders through react-dom/server here because the artwork is
 * inert markup — no hooks, no state — and the failure modes worth guarding
 * are all visible in the markup itself: a piece variant that renders empty,
 * or a fill/stroke that slipped back to a literal colour instead of a
 * tokens.css §14 variable (the artwork's source SVGs use #fff/#000/#ececec,
 * so a careless re-import would reintroduce them and break theming).
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
        expect(svg, `${colour}${type}`).toContain('viewBox="0 0 45 45"')
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

  it('is hidden from the accessibility tree (squares carry the labels)', () => {
    expect(render('w', 'k')).toContain('aria-hidden="true"')
  })
})
