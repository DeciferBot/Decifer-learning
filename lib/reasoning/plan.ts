/**
 * Decifer Reasoning Check — the shape of a paper, and the adaptive ladder.
 *
 * 24 questions, 6 of each of the four item types. Scope:
 * docs/REASONING_TEST_SCOPE.md §6, §7.
 *
 * WHY THE LADDER IS HONEST HERE AND NOWHERE ELSE IN THE PRODUCT: adaptive
 * testing normally needs calibrated difficulties, and `lib/irt.ts` has none
 * (0 of 8,277 items). Here difficulty is not an estimate at all. It is a
 * property of the generator: a level-5 item varies three attributes because we
 * built it that way. So "get one right, go up" is a real move up a real ladder,
 * not a guess dressed as personalisation.
 *
 * The ladder runs PER TYPE. A child who reads matrices easily and cannot see
 * rotations should climb on one and not the other, and a single shared level
 * would average that away into nothing.
 *
 * PURE: no DB, no network, no Math.random(), no Date.now(). The item at any
 * position is a function of (token, answers so far), which is what lets a reload
 * mid-test return exactly the same question.
 */

import { seededShuffle } from '@/lib/seeded-random'
import {
  REASONING_ITEM_TYPES,
  MIN_LEVEL,
  MAX_LEVEL,
  type Level,
  type ReasoningItemType,
} from './generate'

/** Items of each type in one paper. Four types, so 24 questions in total. */
export const ITEMS_PER_TYPE = 6

/** Length of a paper. Roughly 12 minutes at the pace these items take. */
export const TOTAL_ITEMS = ITEMS_PER_TYPE * REASONING_ITEM_TYPES.length

/**
 * Where every type starts.
 *
 * Level 2, not 3. A perfect run still reaches 6 with a level to spare
 * (2,3,4,5,6,6), and a child who is going to struggle meets a fair question
 * first rather than a hard one. Opening a free test with an item most takers
 * fail is a good way to have them close the tab.
 */
export const START_LEVEL: Level = 2

// ── Age band ─────────────────────────────────────────────────────────────────
//
// A BAND, never a date of birth (scope §10). It changes nothing about the test:
// the ladder finds the child's level on its own, so the band is stored only so
// that a like-for-like comparison becomes possible once enough children have
// taken it (scope §9). Until then it is unused, and the page says so.

export const AGE_BANDS = ['year_3_4', 'year_5_6', 'year_7_8', 'not_said'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  year_3_4: 'Year 3 to 4 (ages 7 to 9)',
  year_5_6: 'Year 5 to 6 (ages 9 to 11)',
  year_7_8: 'Year 7 to 8 (ages 11 to 13)',
  not_said: 'Rather not say',
}

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === 'string' && (AGE_BANDS as readonly string[]).includes(value)
}

// ── The paper ────────────────────────────────────────────────────────────────

/**
 * Which item type sits at each position.
 *
 * Round-robin over a per-attempt shuffled order, so a child never faces six
 * matrices in a row, and two children do not open with the same type. Seeded off
 * the attempt token, so it is stable for a whole attempt.
 */
export function planTypes(token: string): ReasoningItemType[] {
  const order = seededShuffle([...REASONING_ITEM_TYPES], `reasoning-order:${token}`)
  return Array.from({ length: TOTAL_ITEMS }, (_, i) => order[i % order.length])
}

/** The seed for one position. The item IS this seed; nothing else is stored. */
export function seedFor(token: string, position: number): string {
  return `${token}:${position}`
}

// ── The ladder ───────────────────────────────────────────────────────────────

/** One step up on a right answer, one step down on a wrong one. Clamped. */
export function nextLevel(current: Level, correct: boolean): Level {
  const moved = correct ? current + 1 : current - 1
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, moved)) as Level
}

/**
 * The level for the next item of a type, given that type's earlier answers in
 * the order they were given.
 *
 * Replayed from scratch every time rather than stored, so the level can never
 * drift out of step with the answers it is supposed to follow from.
 */
export function levelAfter(priorCorrect: boolean[]): Level {
  let level: Level = START_LEVEL
  for (const correct of priorCorrect) level = nextLevel(level, correct)
  return level
}
