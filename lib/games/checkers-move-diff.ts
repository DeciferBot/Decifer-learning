import type { Board } from '@/lib/games/checkers-ai'

/**
 * Works out which discs moved between two checkers boards, so the grid can
 * slide the mover from its old square — across the whole diagonal of a
 * multi-jump in one motion — and fade the jumped pieces where they stood.
 *
 * Same design as lib/games/chess-move-diff.ts: diffing positions rather
 * than threading move objects through means the identical animation drives
 * computer mode and online mode (where the server sends back only the
 * resulting board), and it degrades gracefully when a Realtime update
 * skips a ply. Squares are keyed "row,col" — the format CheckersGrid
 * already uses.
 */

export type CheckersMoveDiff = {
  /** destination "r,c" -> the "r,c" that disc came from */
  origins: Map<string, string>
  /** squares a moving disc left — the old occupant vanishes instantly
   *  (the slide IS the animation); jumped discs are NOT in this set, so
   *  they fade out where they were captured */
  moved: Set<string>
  /** true when the boards differ by more than a ply or two could — a new
   *  game, a reload — so nothing should animate at all */
  reset: boolean
}

export function diffCheckersPositions(prev: Board | null, next: Board): CheckersMoveDiff {
  const none: CheckersMoveDiff = { origins: new Map(), moved: new Set(), reset: true }
  if (!prev) return none

  const arrived: { key: string; color: string; king: boolean }[] = []
  const departed: { key: string; color: string; king: boolean }[] = []
  for (let r = 0; r < prev.length; r++) {
    for (let c = 0; c < prev[r].length; c++) {
      const a = prev[r][c]
      const b = next[r]?.[c] ?? null
      const same = !!a && !!b && a.color === b.color && a.king === b.king
      if (a && !same) departed.push({ key: `${r},${c}`, color: a.color, king: a.king })
      if (b && !same) arrived.push({ key: `${r},${c}`, color: b.color, king: b.king })
    }
  }

  // One ply lands exactly one disc; allow two so a skipped broadcast (one
  // move per side) still animates. More than that is a reset.
  if (arrived.length === 0 || arrived.length > 2) {
    return { ...none, reset: arrived.length > 2 }
  }

  const origins = new Map<string, string>()
  const pool = [...departed]
  for (const disc of arrived) {
    // The origin is a vacated square that held this side's disc — exact
    // king status first, then any of the colour (crowning turns a man
    // into a king on arrival).
    let at = pool.findIndex((d) => d.color === disc.color && d.king === disc.king)
    if (at === -1) at = pool.findIndex((d) => d.color === disc.color)
    if (at === -1) continue
    origins.set(disc.key, pool[at].key)
    pool.splice(at, 1)
  }

  return { origins, moved: new Set(origins.values()), reset: false }
}
