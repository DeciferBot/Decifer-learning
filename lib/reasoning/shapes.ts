/**
 * Decifer Reasoning Check — the shape model and its SVG rendering.
 *
 * Every non-verbal reasoning item in this product is built from one small data
 * type, `Figure`. A figure is some number of copies of one shape, at a size,
 * with a fill, at a rotation. That is the entire vocabulary, and it is enough to
 * express sequences, matrices, analogies and odd-one-out items (see generate.ts).
 *
 * WHY IT IS THIS SMALL: the correct answer to a reasoning item has to be right by
 * construction, not by checking. A tiny attribute space means a transformation is
 * a total function over figures, so applying it cannot fail and cannot be
 * ambiguous. Every attribute added multiplies the ways two items can accidentally
 * both be correct.
 *
 * FILL IS NEVER COLOUR. Fills are hatching, dots, solid and empty. A child who
 * cannot distinguish colours must be able to take this test, and colour-only
 * encoding would also fail WCAG 2.2.
 *
 * PURE: no DB, no network, no randomness. Rendering returns an SVG string.
 */

export const SHAPE_KINDS = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon'] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]

export const FILLS = ['none', 'hatch', 'dots', 'solid'] as const
export type Fill = (typeof FILLS)[number]

/** 1 small, 2 medium, 3 large. Kept coarse so a size step is unmistakable. */
export const SIZES = [1, 2, 3] as const
export type Size = (typeof SIZES)[number]

/** Rotations in degrees, in 45° steps. */
export const ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315] as const
export type Rotation = (typeof ROTATIONS)[number]

/** Copies of the shape drawn in one cell. */
export const COUNTS = [1, 2, 3, 4] as const
export type Count = (typeof COUNTS)[number]

export interface Figure {
  kind: ShapeKind
  size: Size
  fill: Fill
  rotation: Rotation
  count: Count
}

/** Structural equality. Two figures are the same item if every attribute matches. */
export function figuresEqual(a: Figure, b: Figure): boolean {
  return (
    a.kind === b.kind &&
    a.size === b.size &&
    a.fill === b.fill &&
    a.rotation === b.rotation &&
    a.count === b.count
  )
}

/** Stable string form. Used to key React lists. */
export function figureKey(f: Figure): string {
  return `${f.kind}:${f.size}:${f.fill}:${f.rotation}:${f.count}`
}

// ── Visual identity ──────────────────────────────────────────────────────────
//
// Two figures can differ in their data and look identical on screen, because
// shapes are symmetric. A circle looks the same at every rotation. A square at
// 90° is a square at 0°. Four shapes arranged in a square look the same after a
// quarter turn.
//
// This matters more than it sounds. A sequence that "rotates" a circle shows a
// child four identical pictures and asks what comes next. An odd-one-out whose
// odd shape is a circle rotated 90° has no visible odd one. Comparing figures by
// their data would call all of those valid, so every comparison that decides
// whether an item is fair uses the VISUAL key below instead.

/** Smallest rotation in degrees that maps a lone shape onto itself. */
const SHAPE_ROTATION_PERIOD: Record<ShapeKind, number> = {
  // Rotations come in 45° steps, so 45 stands for "every step looks the same".
  circle: 45,
  square: 90,
  diamond: 90,
  triangle: 120,
  pentagon: 72,
  hexagon: 60,
}

/** Smallest rotation that maps the ARRANGEMENT of `count` copies onto itself. */
const LAYOUT_ROTATION_PERIOD: Record<Count, number> = {
  1: 45, // a single centred shape imposes no constraint of its own
  2: 180,
  3: 120,
  4: 90,
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b)
}

/**
 * The rotation after which this figure looks exactly as it did.
 *
 * A rotation must map both the shape and the arrangement onto themselves, so the
 * period is the lowest common multiple of the two.
 */
export function rotationPeriod(f: Figure): number {
  return Math.min(360, lcm(SHAPE_ROTATION_PERIOD[f.kind], LAYOUT_ROTATION_PERIOD[f.count]))
}

/** Rotation reduced to what is actually visible for this figure. */
export function effectiveRotation(f: Figure): number {
  return f.rotation % rotationPeriod(f)
}

/**
 * Identity as a child sees it. Two figures with the same visual key are the same
 * picture, whatever their stored rotation says.
 */
export function visualKey(f: Figure): string {
  return `${f.kind}:${f.size}:${f.fill}:${effectiveRotation(f)}:${f.count}`
}

/** True when two figures render identically. */
export function visuallyEqual(a: Figure, b: Figure): boolean {
  return visualKey(a) === visualKey(b)
}

// ── Description, for screen readers ──────────────────────────────────────────
//
// A non-verbal test is visual, and no wording makes it fully non-visual. But an
// accurate description makes it navigable, and for some children answerable.
// See docs/REASONING_TEST_SCOPE.md §8.

const SIZE_WORD: Record<Size, string> = { 1: 'small', 2: 'medium', 3: 'large' }
const FILL_WORD: Record<Fill, string> = {
  none: 'unfilled',
  hatch: 'with diagonal stripes',
  dots: 'with dots',
  solid: 'filled in',
}
const COUNT_WORD: Record<Count, string> = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four' }

/** Plain-English description of a figure, e.g. "Two large striped triangles, rotated 90 degrees". */
export function describeFigure(f: Figure): string {
  const plural = f.count > 1
  const kind = plural ? `${f.kind}s` : f.kind
  const parts = [`${COUNT_WORD[f.count]} ${SIZE_WORD[f.size]} ${kind}`, FILL_WORD[f.fill]]
  if (f.rotation !== 0) parts.push(`rotated ${f.rotation} degrees`)
  return parts.join(', ')
}

// ── SVG rendering ────────────────────────────────────────────────────────────

/** Viewbox side of one cell. Everything below is in these units. */
export const CELL = 100

const RADIUS: Record<Size, number> = { 1: 13, 2: 20, 3: 28 }

/** Where each copy sits when a cell holds `count` shapes. */
// Centres are spaced to clear the 3px stroke as well as the shape itself, so a
// pair of large shapes sits side by side instead of touching.
const LAYOUT: Record<Count, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 50], [72, 50]],
  3: [[50, 28], [28, 68], [72, 68]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
}

/**
 * Scale shapes down when several share a cell.
 *
 * Values are set so the largest size never overlaps its neighbours: the centres
 * in LAYOUT are 38 units apart for count 2 and 36 for counts 3 and 4, so the
 * scaled radius of a size-3 shape (28) must stay under half of that.
 */
const COUNT_SCALE: Record<Count, number> = { 1: 1, 2: 0.62, 3: 0.56, 4: 0.55 }

function polygonPoints(sides: number, cx: number, cy: number, r: number): string {
  const pts: string[] = []
  // Start at the top so a triangle points up and a pentagon reads the right way.
  const offset = -Math.PI / 2
  for (let i = 0; i < sides; i++) {
    const angle = offset + (i * 2 * Math.PI) / sides
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return pts.join(' ')
}

function shapeElement(kind: ShapeKind, cx: number, cy: number, r: number, attrs: string): string {
  switch (kind) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" ${attrs}/>`
    case 'square':
      return `<polygon points="${polygonPoints(4, cx, cy, r)}" transform="rotate(45 ${cx} ${cy})" ${attrs}/>`
    case 'diamond':
      return `<polygon points="${polygonPoints(4, cx, cy, r)}" ${attrs}/>`
    case 'triangle':
      return `<polygon points="${polygonPoints(3, cx, cy, r)}" ${attrs}/>`
    case 'pentagon':
      return `<polygon points="${polygonPoints(5, cx, cy, r)}" ${attrs}/>`
    case 'hexagon':
      return `<polygon points="${polygonPoints(6, cx, cy, r)}" ${attrs}/>`
  }
}

/**
 * The hatch and dot patterns, defined once per rendered SVG.
 *
 * `idPrefix` namespaces the pattern ids. Several figures appear on one page, and
 * duplicate SVG ids would make every figure use whichever pattern rendered last.
 */
export function patternDefs(idPrefix: string): string {
  return (
    `<defs>` +
    `<pattern id="${idPrefix}-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-width="2"/>` +
    `</pattern>` +
    `<pattern id="${idPrefix}-dots" width="7" height="7" patternUnits="userSpaceOnUse">` +
    `<circle cx="2.5" cy="2.5" r="1.6" fill="currentColor"/>` +
    `</pattern>` +
    `</defs>`
  )
}

function fillAttr(fill: Fill, idPrefix: string): string {
  switch (fill) {
    case 'none':
      return 'fill="none"'
    case 'solid':
      return 'fill="currentColor"'
    case 'hatch':
      return `fill="url(#${idPrefix}-hatch)"`
    case 'dots':
      return `fill="url(#${idPrefix}-dots)"`
  }
}

/**
 * Render one figure as a self-contained SVG string.
 *
 * `idPrefix` must be unique on the page. Rotation is applied to the whole cell,
 * not to each copy, so "rotated 90 degrees" means the arrangement turns too,
 * which is what these tests actually ask about.
 */
export function renderFigure(f: Figure, idPrefix: string): string {
  const r = RADIUS[f.size] * COUNT_SCALE[f.count]
  const attrs = `${fillAttr(f.fill, idPrefix)} stroke="currentColor" stroke-width="3" stroke-linejoin="round"`
  const shapes = LAYOUT[f.count]
    .map(([cx, cy]) => shapeElement(f.kind, cx, cy, r, attrs))
    .join('')

  return (
    `<svg viewBox="0 0 ${CELL} ${CELL}" xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="${escapeAttr(describeFigure(f))}">` +
    `<title>${escapeAttr(describeFigure(f))}</title>` +
    patternDefs(idPrefix) +
    `<g transform="rotate(${f.rotation} ${CELL / 2} ${CELL / 2})">${shapes}</g>` +
    `</svg>`
  )
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
