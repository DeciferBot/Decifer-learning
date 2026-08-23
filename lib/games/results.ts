// A finished Downtime game, as reported by the game components. Logged-in
// players get a row in downtime_results (their game history); guests get
// nothing recorded and the game-over card invites them to register instead.
//
// This module is imported from BOTH sides — the client helper below posts a
// result, and /api/downtime/results validates against the same constant
// lists — so it must stay free of server-only imports.

import type { GameId } from './catalogue'

export const RESULT_MODES = ['computer', 'friend', 'solo'] as const
export const RESULT_OUTCOMES = ['win', 'loss', 'draw'] as const
export const RESULT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const
/** Mirrors the DB check constraint — far above any real Word Tiles score. */
export const RESULT_SCORE_MAX = 100000

export type GameResultInput = {
  gameType: GameId
  mode: (typeof RESULT_MODES)[number]
  outcome: (typeof RESULT_OUTCOMES)[number]
  difficulty?: (typeof RESULT_DIFFICULTIES)[number]
  score?: number
}

/** What became of a reported result: recorded, nobody to record it against,
 *  or the request failed (offline, server error). */
export type SaveStatus = 'saved' | 'signed_out' | 'error'

export async function reportGameResult(input: GameResultInput): Promise<SaveStatus> {
  try {
    const res = await fetch('/api/downtime/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) return 'error'
    const data = (await res.json()) as { saved?: boolean }
    return data.saved ? 'saved' : 'signed_out'
  } catch {
    return 'error'
  }
}
