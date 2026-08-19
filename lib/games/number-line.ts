/**
 * Geometry for the Number Line practice activity.
 *
 * Pure and separate from the component so the arithmetic can be tested. All
 * three functions guard against values from `practice_games.config_json`,
 * which is untrusted JSON out of the database, not a typed config.
 */

/** Half the painted handle. The track insets by this at each end. */
export const THUMB_RADIUS = 22

/**
 * A step that terminates.
 *
 * A zero or negative step makes `for (v = min; v <= max; v += step)` loop
 * forever, hanging the browser tab rather than showing a broken widget. A
 * very small step over a wide range is the opposite problem: thousands of
 * absolutely-positioned tick elements.
 */
export function safeStep(step: number, min: number, max: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1
  const span = Math.abs(max - min)
  if (span === 0) return 1
  return span / step > 200 ? span / 200 : step
}

export type Tick = { v: number; isMajor: boolean }

/**
 * Tick marks from min to max.
 *
 * Counted rather than accumulated: `v += step` drifts on a fractional step,
 * so a 0.5 step produced values like 2.4999999998, and testing
 * `v % (step * 5) === 0` for the numbered ticks then matched nothing — the
 * line rendered with no labels at all.
 */
export function ticksFor(min: number, max: number, step: number): Tick[] {
  const s = safeStep(step, min, max)
  const count = Math.max(0, Math.floor((max - min) / s))
  return Array.from({ length: count + 1 }, (_, i) => ({
    v: Number((min + i * s).toFixed(6)),
    isMajor: i % 5 === 0 || i === count,
  }))
}

/**
 * Where a value sits along the track, in pixels.
 *
 * Inset by half the handle at each end, because that is how a native range
 * input maps its value: the thumb centre travels from `THUMB_RADIUS` to
 * `width - THUMB_RADIUS`, never to the bare edges. Painting across the full
 * width instead left the handle up to 22px from the finger dragging it, and
 * hanging off the end of the track at max.
 */
export function valueToX(value: number, min: number, max: number, width: number): number {
  const usable = Math.max(0, width - THUMB_RADIUS * 2)
  const span = max - min || 1
  const clamped = Math.max(min, Math.min(max, value))
  return THUMB_RADIUS + ((clamped - min) / span) * usable
}
