/**
 * Rendering for Reasoning Check figures and stimuli.
 *
 * Works on the server and in the browser, so the same components draw the live
 * test, the worked examples on the public pages, and anything else that needs a
 * figure.
 *
 * ACCESSIBILITY (scope §8). This test is visual and no wording makes it
 * otherwise, but it can be made navigable and, for some children, answerable:
 *   - every cell carries a description that says where it sits AND what it
 *     shows, e.g. "Row 2, column 3. Two large triangles, with dots";
 *   - the inner SVG is hidden from assistive technology so its own label is not
 *     read a second time straight after the contextual one;
 *   - fills are hatching, dots, solid and empty, never colour, so nothing here
 *     depends on distinguishing colours.
 *
 * The SVG string comes from lib/reasoning/shapes.ts, which builds it from a
 * five-attribute enum vocabulary and escapes the description it embeds. There is
 * no path by which caller input reaches the markup, which is what makes
 * dangerouslySetInnerHTML the right call rather than reimplementing the geometry
 * a second time in JSX.
 */

import { describeFigure, renderFigure, type Figure } from '@/lib/reasoning/shapes'
import type { Stimulus } from '@/lib/reasoning/generate'

export function FigureCell({
  figure,
  idPrefix,
  label,
  className = '',
}: {
  figure: Figure
  idPrefix: string
  /**
   * Full accessible description, including any positional context. Pass null
   * when something outside already names the figure — an option button labels
   * itself "Option 3. Two large triangles", and repeating that inside it would
   * have a screen reader read the shape twice.
   */
  label?: string | null
  className?: string
}) {
  const decorative = label === null
  return (
    <div
      {...(decorative
        ? { 'aria-hidden': true as const }
        : { role: 'img', 'aria-label': label ?? describeFigure(figure) })}
      className={`flex aspect-square items-center justify-center rounded-xl border border-black/10 bg-surface p-1.5 text-ink ${className}`}
    >
      <span
        aria-hidden="true"
        className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: renderFigure(figure, idPrefix) }}
      />
    </div>
  )
}

/** The gap the child is filling in. Reads as "the missing shape", not as "?". */
export function BlankCell({ className = '' }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The missing shape. This is what you are choosing."
      className={`flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-ink-2/40 bg-background text-2xl font-bold text-ink-2 ${className}`}
    >
      <span aria-hidden="true">?</span>
    </div>
  )
}

/**
 * Draw the part of an item the child reads before choosing.
 *
 * Odd-one-out has no stimulus: its five figures ARE the options, so it renders
 * nothing here and the option grid carries the whole question.
 */
export function StimulusView({ stimulus, idPrefix }: { stimulus: Stimulus; idPrefix: string }) {
  switch (stimulus.kind) {
    case 'sequence':
      return (
        <ol className="flex list-none flex-wrap items-center gap-2">
          {stimulus.figures.map((f, i) => (
            <li key={i} className="w-[17%] min-w-[52px] flex-1">
              <FigureCell
                figure={f}
                idPrefix={`${idPrefix}-s${i}`}
                label={`Shape ${i + 1} of 5. ${describeFigure(f)}`}
              />
            </li>
          ))}
          <li className="w-[17%] min-w-[52px] flex-1">
            <BlankCell />
          </li>
        </ol>
      )

    case 'matrix':
      return (
        <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2">
          {stimulus.grid.map((row, r) =>
            row.map((f, c) =>
              f ? (
                <FigureCell
                  key={`${r}-${c}`}
                  figure={f}
                  idPrefix={`${idPrefix}-m${r}${c}`}
                  label={`Row ${r + 1}, column ${c + 1}. ${describeFigure(f)}`}
                />
              ) : (
                <BlankCell key={`${r}-${c}`} />
              ),
            ),
          )}
        </div>
      )

    case 'analogy':
      // Two rows, not one.
      //
      // The first pass put all four cells in a single row with a divider between
      // the pairs. At 375px the last cell wrapped onto its own line, so the
      // question read as "A becomes B, then C becomes" with a lonely question
      // mark underneath. Stacking the pairs is how these are printed on paper
      // anyway, and it makes the two halves line up so the change is easier to
      // see.
      return (
        <div className="mx-auto grid max-w-[270px] grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-3">
          <FigureCell
            figure={stimulus.a}
            idPrefix={`${idPrefix}-a`}
            label={`First shape. ${describeFigure(stimulus.a)}`}
          />
          <span aria-hidden="true" className="text-lg font-bold text-ink-2">
            →
          </span>
          <FigureCell
            figure={stimulus.b}
            idPrefix={`${idPrefix}-b`}
            label={`becomes this. ${describeFigure(stimulus.b)}`}
          />
          <FigureCell
            figure={stimulus.c}
            idPrefix={`${idPrefix}-c`}
            label={`In the same way, this shape. ${describeFigure(stimulus.c)}`}
          />
          <span aria-hidden="true" className="text-lg font-bold text-ink-2">
            →
          </span>
          <BlankCell />
        </div>
      )

    case 'odd_one_out':
      return null
  }
}

/** "Option 3. Two large triangles, with dots" — what a button announces. */
export function optionLabel(index: number, description: string): string {
  return `Option ${index + 1}. ${description}`
}
