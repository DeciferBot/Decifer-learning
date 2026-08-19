import { describe, it, expect } from 'vitest'
import {
  initialScrabbleGame, dealGuestRack, applyScrabbleTurn, parseScrabbleMove,
  type ScrabblePublicState, type ScrabbleHostPrivate, type ScrabbleGuestPrivate,
} from '../lib/downtime/scrabble-flow'
import { createEmptyScrabbleBoard } from '../lib/games/scrabble-engine'
import { CENTER } from '../lib/games/scrabble-board'

describe('parseScrabbleMove', () => {
  it('parses a valid pass, exchange and place move', () => {
    expect(parseScrabbleMove({ type: 'pass' })).toEqual({ type: 'pass' })
    expect(parseScrabbleMove({ type: 'exchange', tiles: ['A', '_'] })).toEqual({ type: 'exchange', tiles: ['A', '_'] })
    expect(parseScrabbleMove({ type: 'place', tiles: [{ row: 7, col: 7, letter: 'a' }] }))
      .toEqual({ type: 'place', tiles: [{ row: 7, col: 7, letter: 'A', isBlank: false }] })
  })

  it('never throws on hostile or malformed input — always returns null instead', () => {
    const hostile = [
      null, undefined, 'string', 42, [], true,
      { type: 'place' }, { type: 'place', tiles: [] }, { type: 'place', tiles: null },
      { type: 'place', tiles: [{ row: 'x', col: 7, letter: 'A' }] },
      { type: 'place', tiles: [{ row: 7, col: 7, letter: 'AB' }] },
      { type: 'place', tiles: [{ row: 7, col: 7, letter: 5 }] },
      { type: 'place', tiles: [null] },
      { type: 'exchange' }, { type: 'exchange', tiles: [] }, { type: 'exchange', tiles: [1, 2] },
      { type: 'exchange', tiles: ['AB'] },
      { type: 'bogus' }, {},
    ]
    for (const input of hostile) {
      expect(() => parseScrabbleMove(input)).not.toThrow()
      expect(parseScrabbleMove(input)).toBeNull()
    }
  })

  it('preserves an explicit isBlank flag', () => {
    const parsed = parseScrabbleMove({ type: 'place', tiles: [{ row: 7, col: 7, letter: 'A', isBlank: true }] })
    expect(parsed).toEqual({ type: 'place', tiles: [{ row: 7, col: 7, letter: 'A', isBlank: true }] })
  })
})

describe('initialScrabbleGame', () => {
  it('deals the host 7 tiles from a fresh 100-tile bag', () => {
    const { publicState, hostPrivate } = initialScrabbleGame()
    expect(hostPrivate.rack).toHaveLength(7)
    expect(hostPrivate.bag).toHaveLength(93)
    expect(publicState.bagCount).toBe(93)
    expect(publicState.hostScore).toBe(0)
    expect(publicState.guestScore).toBe(0)
    expect(publicState.consecutivePasses).toBe(0)
    expect(publicState.board).toEqual(createEmptyScrabbleBoard())
  })
})

describe('dealGuestRack', () => {
  it('deals the guest 7 tiles from the same bag, shrinking it further', () => {
    const { hostPrivate: h0 } = initialScrabbleGame()
    const { hostPrivate, guestPrivate } = dealGuestRack(h0)
    expect(guestPrivate.rack).toHaveLength(7)
    expect(hostPrivate.bag).toHaveLength(86) // 100 - 7 (host) - 7 (guest)
    expect(hostPrivate.rack).toEqual(h0.rack) // host's own rack is untouched
  })
})

describe('applyScrabbleTurn — placing', () => {
  it('scores the mover, advances turn, and resets the pass counter', () => {
    const publicState: ScrabblePublicState = {
      board: createEmptyScrabbleBoard(), bagCount: 10, hostScore: 0, guestScore: 0,
      consecutivePasses: 3, lastMove: null,
    }
    const hostPrivate: ScrabbleHostPrivate = { rack: ['C', 'A', 'T', 'X', 'X', 'X', 'X'], bag: Array(10).fill('Z') }
    const guestPrivate: ScrabbleGuestPrivate = { rack: ['B', 'B'] }

    const result = applyScrabbleTurn(publicState, hostPrivate, guestPrivate, 'host', {
      type: 'place',
      tiles: [
        { row: CENTER, col: 6, letter: 'C', isBlank: false },
        { row: CENTER, col: 7, letter: 'A', isBlank: false },
        { row: CENTER, col: 8, letter: 'T', isBlank: false },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.publicState.hostScore).toBe(10) // CAT (3+1+1) doubled by the centre star
    expect(result.publicState.guestScore).toBe(0)
    expect(result.publicState.consecutivePasses).toBe(0)
    expect(result.turn).toBe('guest')
    expect(result.winner).toBeNull()
    expect(result.hostPrivate.rack).toHaveLength(7) // 4 X's kept + 3 refilled from the bag
    expect(result.guestPrivate.rack).toEqual(['B', 'B']) // guest's rack is untouched by host's move
    expect(result.publicState.lastMove).toEqual({ by: 'host', type: 'place', words: ['CAT'], points: 10 })
  })

  it('rejects an illegal placement without mutating anything, reporting the engine error', () => {
    const publicState: ScrabblePublicState = {
      board: createEmptyScrabbleBoard(), bagCount: 10, hostScore: 5, guestScore: 5,
      consecutivePasses: 0, lastMove: null,
    }
    const hostPrivate: ScrabbleHostPrivate = { rack: ['C', 'A', 'T'], bag: [] }
    const guestPrivate: ScrabbleGuestPrivate = { rack: ['B'] }
    // Doesn't cover the centre — illegal first move.
    const result = applyScrabbleTurn(publicState, hostPrivate, guestPrivate, 'host', {
      type: 'place',
      tiles: [
        { row: 0, col: 0, letter: 'C', isBlank: false }, { row: 0, col: 1, letter: 'A', isBlank: false }, { row: 0, col: 2, letter: 'T', isBlank: false },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('must_cover_center')
  })
})

describe('applyScrabbleTurn — pass / stall end condition', () => {
  it('a pass advances turn and increments the pass counter without scoring', () => {
    const publicState: ScrabblePublicState = {
      board: createEmptyScrabbleBoard(), bagCount: 10, hostScore: 4, guestScore: 4,
      consecutivePasses: 2, lastMove: null,
    }
    const result = applyScrabbleTurn(publicState, { rack: ['X'], bag: ['Y'] }, { rack: ['X'] }, 'guest', { type: 'pass' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.publicState.consecutivePasses).toBe(3)
    expect(result.turn).toBe('host')
    expect(result.winner).toBeNull()
  })

  it('the 6th consecutive scoreless turn ends the game, winner decided by current score', () => {
    const publicState: ScrabblePublicState = {
      board: createEmptyScrabbleBoard(), bagCount: 10, hostScore: 30, guestScore: 12,
      consecutivePasses: 5, lastMove: null,
    }
    const result = applyScrabbleTurn(publicState, { rack: ['X'], bag: ['Y'] }, { rack: ['X'] }, 'guest', { type: 'pass' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.publicState.consecutivePasses).toBe(6)
    expect(result.winner).toBe('host')
  })

  it('a tied score at the stall threshold is a draw', () => {
    const publicState: ScrabblePublicState = {
      board: createEmptyScrabbleBoard(), bagCount: 10, hostScore: 20, guestScore: 20,
      consecutivePasses: 5, lastMove: null,
    }
    const result = applyScrabbleTurn(publicState, { rack: ['X'], bag: ['Y'] }, { rack: ['X'] }, 'host', { type: 'pass' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.winner).toBe('draw')
  })
})

describe('applyScrabbleTurn — empty rack + empty bag end condition', () => {
  it("transfers the opponent's remaining rack value and ends the game", () => {
    const publicState: ScrabblePublicState = {
      board: createEmptyScrabbleBoard(), bagCount: 0, hostScore: 0, guestScore: 0,
      consecutivePasses: 0, lastMove: null,
    }
    const hostPrivate: ScrabbleHostPrivate = { rack: ['C', 'A', 'T'], bag: [] } // exactly empties on this move
    const guestPrivate: ScrabbleGuestPrivate = { rack: ['Q', 'Z'] } // 10 + 10 = 20 points left unplayed

    const result = applyScrabbleTurn(publicState, hostPrivate, guestPrivate, 'host', {
      type: 'place',
      tiles: [
        { row: CENTER, col: 6, letter: 'C', isBlank: false },
        { row: CENTER, col: 7, letter: 'A', isBlank: false },
        { row: CENTER, col: 8, letter: 'T', isBlank: false },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.hostPrivate.rack).toHaveLength(0)
    // CAT scores 10 (as in the earlier test), plus the opponent's 20 leftover rack value.
    expect(result.publicState.hostScore).toBe(30)
    expect(result.publicState.guestScore).toBe(-20)
    expect(result.winner).toBe('host')
  })
})
