import { describe, it, expect } from 'vitest'
import { buildFeedback, MARKING_UNAVAILABLE_FEEDBACK } from '@/lib/quiz-marking-feedback'

// Every word a child reads after a written answer is marked comes out of this
// function. It used to come out of a model, unread by anything in between,
// which is what verify-content-safety.mjs check 7 exists to prevent.
//
// So these are not tests of a helper. They are the reason the model is allowed
// anywhere near this route at all: the child's screen is now something that can
// be asserted about.

const RUBRIC = [
  { criterion: 'Water evaporates from the surface', marks: 1 },
  { criterion: 'The vapour rises and cools', marks: 1 },
  { criterion: 'It condenses into clouds', marks: 2 },
]

describe('what the child reads', () => {
  it('opens differently for full marks and for none', () => {
    const full = buildFeedback(RUBRIC, [0, 1, 2])
    const none = buildFeedback(RUBRIC, [])
    expect(full).toMatch(/full marks/i)
    expect(none).not.toMatch(/full marks/i)
    expect(none).toMatch(/not quite/i)
  })

  it('does not tell a child who got one mark in four that it is perfect', () => {
    const partial = buildFeedback(RUBRIC, [0])
    expect(partial).not.toMatch(/full marks|every part/i)
    expect(partial).toMatch(/start/i)
  })

  it('names what they got right, using the words a human wrote', () => {
    const out = buildFeedback(RUBRIC, [0])
    expect(out).toContain('water evaporates from the surface')
  })

  it('asks for one more thing, not a list of everything missed', () => {
    const out = buildFeedback(RUBRIC, [])
    const nextTimes = out.match(/Next time/g) || []
    expect(nextTimes).toHaveLength(1)
  })

  it('says nothing to add when everything was met', () => {
    expect(buildFeedback(RUBRIC, [0, 1, 2])).not.toMatch(/next time/i)
  })

  it('is deterministic, so the same marking always reads the same', () => {
    expect(buildFeedback(RUBRIC, [0, 2])).toBe(buildFeedback(RUBRIC, [0, 2]))
  })
})

describe('it holds up on bad input', () => {
  it('survives an empty rubric without throwing', () => {
    expect(() => buildFeedback([], [])).not.toThrow()
    expect(buildFeedback([], [])).toBeTruthy()
  })

  it('ignores indices that are not in the rubric', () => {
    // The route bounds-checks before calling, but a second line of defence
    // here costs nothing and this is the function a child's screen depends on.
    const out = buildFeedback(RUBRIC, [99, -1])
    expect(out).toBeTruthy()
    expect(out).not.toContain('undefined')
  })

  it('never emits undefined or empty text', () => {
    for (const met of [[], [0], [1, 2], [0, 1, 2], [5]]) {
      const out = buildFeedback(RUBRIC, met)
      expect(out.length).toBeGreaterThan(0)
      expect(out).not.toContain('undefined')
    }
  })

  it('handles a criterion that is blank', () => {
    const out = buildFeedback([{ criterion: '   ', marks: 1 }], [0])
    expect(out).not.toContain('undefined')
    expect(out.trim()).toBeTruthy()
  })

  it('has something to say when the model call fails outright', () => {
    expect(MARKING_UNAVAILABLE_FEEDBACK).toMatch(/could not mark/i)
  })
})
