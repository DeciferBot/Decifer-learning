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
  it('keeps typing, pairing and ordering out of exams and Blitz', () => {
    // Those two screens build their own buttons out of the right answer and the
    // wrong ones. A question with no wrong answers would appear as a single
    // button with the answer written on it.
    for (const shape of ['short_answer_text', 'match_pairs', 'ordered_list']) {
      expect(NEEDS_ITS_OWN_ANSWER_AREA.has(shape)).toBe(true)
    }
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
