import { readFileSync } from 'node:fs'
import wordListPath from 'word-list'

// A ~274k-word general English list (MIT licensed, github.com/sindresorhus/word-list,
// itself derived from github.com/atebits/Words) — used instead of an official
// Scrabble tournament dictionary (TWL/SOWPODS), which are Hasbro/Mattel-
// licensed word lists this project has no rights to redistribute. Loaded and
// cached once per server process; never bundled to the client — word
// validation is entirely server-side, the same principle as every other
// server-authoritative move check in lib/downtime/. No 'server-only' guard
// (unlike lib/live/server.ts / lib/downtime/server.ts) so this stays
// directly unit-testable under vitest, the same way lib/live/nickname.ts is
// split out from lib/live/server.ts — the `node:fs` import itself would
// already break a client bundle immediately if this were ever imported
// from client code, which is guard enough here.

// A general English word list includes plenty of real dictionary words most
// parents wouldn't want their kid handed 8 points for spelling. This is a
// children's product — lib/live/nickname.ts already treats profanity as
// something to actively filter for exactly that reason ("a child who has to
// pick a second nickname is a smaller harm than a child seeing a slur"). This
// list applies the same stance here: an EXACT-match exclusion (not the fuzzy
// substring/look-alike matching nickname.ts uses for freeform text, which
// would misfire on real words like "assassin" or "Scunthorpe") removing
// common profanity, crude anatomical/sexual terms, and slurs from the set of
// playable words. Not exhaustive — this is a reasonable, proportionate pass
// over the obvious cases, not a claim of completeness.
const EXCLUDED_WORDS = new Set([
  'ASS', 'ARSE', 'BLOODY', 'BUGGER', 'DAMN', 'HELL', 'CRAP', 'PISS', 'TWAT',
  'BASTARD', 'BITCH', 'WHORE', 'SLUT', 'WANK', 'WANKER', 'SHIT', 'SHITS', 'SHITTY',
  'FUCK', 'FUCKS', 'FUCKED', 'FUCKING', 'FUCKER',
  'DICK', 'DICKS', 'COCK', 'COCKS', 'PRICK', 'CUNT', 'PUSSY', 'TIT', 'TITS', 'BOOB', 'BOOBS',
  'ANUS', 'PENIS', 'VAGINA', 'SEX', 'ORGASM', 'PORN', 'RAPE', 'RAPIST',
  'NIGGER', 'NIGGA', 'CHINK', 'GOOK', 'KIKE', 'SPIC', 'FAGGOT', 'FAG', 'TRANNY', 'RETARD', 'SPASTIC',
  'NAZI', 'HITLER',
])

let cache: Set<string> | null = null
let wordsCache: string[] | null = null

function dictionary(): Set<string> {
  if (!cache) {
    const words = readFileSync(wordListPath, 'utf8').split('\n')
    cache = new Set(
      words
        .map((w) => w.trim().toUpperCase())
        .filter((w) => w.length >= 2 && !EXCLUDED_WORDS.has(w)),
    )
  }
  return cache
}

export function isValidWord(word: string): boolean {
  return dictionary().has(word.toUpperCase())
}

/** Every playable word, for the computer opponent's move generator
 *  (lib/games/scrabble-ai.ts). Same filtered set as isValidWord — the
 *  computer can never play a word a child's own placement would be
 *  rejected for, and vice versa. */
export function dictionaryWords(): readonly string[] {
  if (!wordsCache) wordsCache = [...dictionary()]
  return wordsCache
}
