/**
 * The four ways a child can answer, and the rules that keep them honest.
 *
 * Oak National Academy writes about 12,000 questions the child answers by typing,
 * by pairing things up, or by putting them in order. These tests guard the two
 * places that decide whether such a question is marked fairly, and whether it is
 * shown somewhere that cannot draw it.
 *
 * Pure functions. No database, no network.
 */

import { describe, it, expect } from 'vitest'
import {
  scoreAnswers,
  MULTIPART_TYPES,
  NEEDS_ITS_OWN_ANSWER_AREA,
} from '@/lib/points'
import { stableChoiceOrder } from '@/lib/quiz/stable-order'

const key = [
  { id: 'pick', question_type: 'oak_maths', correct_answer: '12' },
  { id: 'typed', question_type: 'short_answer_text', correct_answer: '12' },
  { id: 'paired', question_type: 'match_pairs', correct_answer: 'a = 1; b = 2' },
  { id: 'ordered', question_type: 'ordered_list', correct_answer: 'cave → arch' },
]

describe('marking a pairing question', () => {
  it('accepts the browser verdict, because there is no single answer to compare', () => {
    // The child pairs four cards. The stored "answer" is a summary, never
    // something the child types, so comparing strings would fail every time.
    const [scored] = scoreAnswers(
      [{ questionId: 'paired', childAnswer: 'a=1; b=2', wasCorrect: true, hintNumber: 0, timeSeconds: 9 }],
      key,
    )
    expect(scored.wasCorrect).toBe(true)
  })

  it('still marks an empty answer wrong, so a blank submission cannot claim a win', () => {
    const [scored] = scoreAnswers(
      [{ questionId: 'paired', childAnswer: '', wasCorrect: true, hintNumber: 0, timeSeconds: 1 }],
      key,
    )
    expect(scored.wasCorrect).toBe(false)
  })
})

describe('marking a typed question', () => {
  it('is checked on the server, not taken on trust', () => {
    // The browser knows every spelling Oak accepts and sends back the tidy form.
    // If something claims a win with the wrong text, the server overrules it.
    const [scored] = scoreAnswers(
      [{ questionId: 'typed', childAnswer: 'nonsense', wasCorrect: true, hintNumber: 0, timeSeconds: 4 }],
      key,
    )
    expect(scored.wasCorrect).toBe(false)
  })

  it('accepts the tidy form the browser sends back', () => {
    const [scored] = scoreAnswers(
      [{ questionId: 'typed', childAnswer: '12', wasCorrect: true, hintNumber: 0, timeSeconds: 4 }],
      key,
    )
    expect(scored.wasCorrect).toBe(true)
  })
})

describe('where each shape is allowed to appear', () => {
  it('keeps typing, pairing and ordering off screens that only draw buttons', () => {
    // Exams, Blitz and the daily challenge build their own buttons out of the right
    // answer and the wrong ones. A question with no wrong answers would appear there
    // as a single button with the answer written on it.
    for (const shape of ['short_answer_text', 'match_pairs', 'ordered_list']) {
      expect(NEEDS_ITS_OWN_ANSWER_AREA.has(shape)).toBe(true)
    }
  })

  it('lets picture questions go everywhere, because they are still tap-one-of-four', () => {
    // They were briefly held back. That was wrong: the shape is ordinary, only the
    // face of each button is a picture. Every screen that offers them reads the
    // pictures, so none of them prints the descriptions instead.
    expect(NEEDS_ITS_OWN_ANSWER_AREA.has('picture_choice')).toBe(false)
  })

  it('marks a picture question on the server like any other pick-one', () => {
    // The answer stored is the right picture's description, and that is exactly
    // what the browser sends back when a child taps it. No special trust needed.
    expect(MULTIPART_TYPES.has('picture_choice')).toBe(false)
    const [right] = scoreAnswers(
      [{ questionId: 'pic', childAnswer: 'a red circle', wasCorrect: true, hintNumber: 0, timeSeconds: 3 }],
      [{ id: 'pic', question_type: 'picture_choice', correct_answer: 'a red circle' }],
    )
    expect(right.wasCorrect).toBe(true)

    const [wrong] = scoreAnswers(
      [{ questionId: 'pic', childAnswer: 'a blue square', wasCorrect: true, hintNumber: 0, timeSeconds: 3 }],
      [{ id: 'pic', question_type: 'picture_choice', correct_answer: 'a red circle' }],
    )
    expect(wrong.wasCorrect).toBe(false)
  })

  it('leaves ordinary pick-one questions alone', () => {
    expect(NEEDS_ITS_OWN_ANSWER_AREA.has('oak_maths')).toBe(false)
    expect(NEEDS_ITS_OWN_ANSWER_AREA.has('maths_arithmetic')).toBe(false)
  })

  it('covers every shape that is marked by the browser', () => {
    for (const shape of MULTIPART_TYPES) {
      expect(NEEDS_ITS_OWN_ANSWER_AREA.has(shape)).toBe(true)
    }
  })
})

describe('the order the answer buttons appear in', () => {
  it('is the same every time for the same question', () => {
    // This is the whole point. The page is drawn once on the server and again in
    // the browser. When the order was random, the two disagreed on every question:
    // the browser kept the pictures the server sent but relabelled the buttons in
    // its own order, so a button showed one picture while carrying another's
    // description — and the green "correct" mark landed on the wrong picture.
    const a = stableChoiceOrder('q-123', 'A', ['B', 'C', 'D'])
    const b = stableChoiceOrder('q-123', 'A', ['B', 'C', 'D'])
    expect(a).toEqual(b)
  })

  it('puts the answers in a different place for different questions', () => {
    // Every picture question stores its answers as the letters A to D, so an order
    // worked out from the answers alone would put the right one in the same place
    // on every single picture question. It comes from the question's id instead.
    const orders = ['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-6']
      .map((id) => stableChoiceOrder(id, 'A', ['B', 'C', 'D']).indexOf('A'))
    expect(new Set(orders).size).toBeGreaterThan(1)
  })

  it('keeps every answer, exactly once', () => {
    const out = stableChoiceOrder('q-9', 'A', ['B', 'C', 'D'])
    expect([...out].sort()).toEqual(['A', 'B', 'C', 'D'])
  })
})
