/**
 * Seeded pseudo-randomness, shared by the Skills Check and the Reasoning Check.
 *
 * WHY SEEDED EVERYWHERE: both features must produce output that is different for
 * every child and identical on every reload for one child. Math.random() gives
 * the first and breaks the second, which means shuffled options jump around
 * mid-test and a bug report can never be reproduced.
 *
 * A seed is a string, so callers can build one out of the things that should
 * vary: an attempt token, an item id, a position.
 *
 * PURE: no DB, no network, no Math.random(), no Date.now().
 */

/** FNV-1a. Small, fast, and well spread for short string seeds. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32 — a tiny seeded PRNG. Returns a function producing [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates driven by `seed`. Never mutates the input. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = [...items]
  const rand = seededRandom(hashSeed(seed))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * A small random-number helper for generators that need many draws from one
 * seed. Every call advances the same stream, so a generator that asks for its
 * values in a fixed order always rebuilds the same item.
 */
export class Rng {
  private next: () => number

  constructor(seed: string) {
    this.next = seededRandom(hashSeed(seed))
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next()
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max <= min) return min
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** One item from a non-empty array. Throws on empty, which is a caller bug. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty array')
    return items[this.int(0, items.length - 1)]
  }

  /** `n` distinct items, or all of them when `n` exceeds the array length. */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.min(n, items.length))
  }

  /** A shuffled copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p
  }
}
