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

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Text to place ON a subject-coloured fill: whichever of ink or white reads
 * better against it. Every colour currently in the palette clears 4.5:1 with
 * the winner.
 */
export function inkOn(background: string): string {
  return contrastRatio(INK, background) >= contrastRatio(PAPER, background) ? INK : PAPER
}

/**
 * The opaque colour you actually get when `colour` is laid over `surface` at
 * `alpha`. Use it instead of an `RRGGBBAA` tint when something readable sits
 * on top: `onPaper` needs to know the real composited background, and
 * guessing it is how a chip ends up at 4.49:1 against a 4.5 target.
 */
export function tint(colour: string, surface: string, alpha: number): string {
  const [fr, fg, fb] = channels(colour)
  const [br, bg, bb] = channels(surface)
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha))
  return (
    '#' +
    [mix(fr, br), mix(fg, bg), mix(fb, bb)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * A subject colour safe to use as text or an icon on a light surface.
 *
 * Darkens the hue toward black in small steps until it clears the ratio,
 * keeping the subject recognisable rather than flattening everything to grey.
 * Returns the original when it already passes (History does).
 */
export function onPaper(colour: string, surface = PAPER, target = 4.5): string {
  if (contrastRatio(colour, surface) >= target) return colour
  const [r, g, b] = channels(colour)
  for (let factor = 0.95; factor >= 0; factor -= 0.05) {
    const shade =
      '#' + [r, g, b].map((v) => Math.round(v * factor).toString(16).padStart(2, '0')).join('')
    if (contrastRatio(shade, surface) >= target) return shade
  }
  return INK
}
