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

let cache: Set<string> | null = null

function dictionary(): Set<string> {
  if (!cache) {
    const words = readFileSync(wordListPath, 'utf8').split('\n')
    cache = new Set(words.map((w) => w.trim().toUpperCase()).filter((w) => w.length >= 2))
  }
  return cache
}

export function isValidWord(word: string): boolean {
  return dictionary().has(word.toUpperCase())
}
