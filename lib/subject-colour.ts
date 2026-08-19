/**
 * Readable text for a subject colour that arrives as data.
 *
 * Subject colours live in the database (`subjects.colour_token`), so pages
 * paint them with an inline `style={{ backgroundColor }}` rather than a
 * Tailwind class. That put them outside every class-level rule, and the
 * badges on /curriculum shipped `text-white` on all of them:
 *
 *   Maths 2.63:1 · English 2.15:1 · Science 1.78:1 · Geography 2.80:1
 *
 * No single fixed text colour fixes all five. Ink clears 4.5:1 on four of
 * them but only reaches 3.70:1 on History, which is dark enough that white
 * wins there instead. So the choice has to be computed, which also
 * means a new subject added to the database gets a readable badge for free.
 */

const INK = '#1F1A14'
const PAPER = '#FFFFFF'

/**
 * `subjects.colour_token` is a free-text column, so it can hold anything: a
 * named colour, an rgb() string, a typo, an empty string after a bad import.
 * Every one of those used to parse to NaN, and NaN fails every comparison,
 * so `inkOn` fell through to WHITE — the single worst answer, because every
 * surface in this app is light. A broken value would have printed white text
 * on a near-white card. Anything unparseable now returns null and the callers
 * fall back to ink.
 */
function channels(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null
  const h = hex.trim().replace(/^#/, '')
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return null
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

/** null for anything unparseable, so callers can choose a safe fallback. */
function luminance(hex: string): number | null {
  const rgb = channels(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 0 when either colour is unparseable: an unknown pairing is never "safe". */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return 0
  const [hi, lo] = [la, lb].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')

/**
 * Text to place ON a subject-coloured fill: whichever of ink or white reads
 * better against it. Every colour currently in the palette clears 4.5:1 with
 * the winner.
 *
 * Falls back to ink for an unreadable background, because every surface in
 * this product is light: dark text on an unknown light card is legible, white
 * text on one is not.
 */
export function inkOn(background: string): string {
  if (!channels(background)) return INK
  return contrastRatio(INK, background) >= contrastRatio(PAPER, background) ? INK : PAPER
}

/**
 * The opaque colour you actually get when `colour` is laid over `surface` at
 * `alpha`. Use it instead of an `RRGGBBAA` tint when something readable sits
 * on top: `onPaper` needs to know the real composited background, and
 * guessing it is how a chip ends up at 4.49:1 against a 4.5 target.
 */
export function tint(colour: string, surface: string, alpha: number): string {
  const fg = channels(colour)
  const bg = channels(surface)
  if (!fg || !bg) return bg ? surface : PAPER
  const a = Math.max(0, Math.min(1, alpha))
  return '#' + fg.map((f, i) => toHex(f * a + bg[i] * (1 - a))).join('')
}

/**
 * A subject colour safe to use as text or an icon on a light surface.
 *
 * Darkens the hue toward black in small steps until it clears the ratio,
 * keeping the subject recognisable rather than flattening everything to grey.
 * Returns the original when it already passes (History does), and ink when
 * the input cannot be read at all.
 */
export function onPaper(colour: string, surface = PAPER, target = 4.5): string {
  const rgb = channels(colour)
  if (!rgb) return INK
  if (contrastRatio(colour, surface) >= target) return colour
  for (let factor = 0.95; factor >= 0; factor -= 0.05) {
    const shade = '#' + rgb.map((v) => toHex(v * factor)).join('')
    if (contrastRatio(shade, surface) >= target) return shade
  }
  return INK
}
