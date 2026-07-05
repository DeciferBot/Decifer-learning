'use client'
import { DiagramWidget } from '@/lib/learn-widgets'
import { getDiagramSvg, DIAGRAM_ASPECT_RATIO } from '../diagrams'
import { WidgetWrapper } from './WidgetWrapper'

interface Props {
  widget: DiagramWidget
}

/**
 * Renders a registry diagram as a static, labelled figure — no game, just an
 * illustration with optional pinned annotations and a caption. This is the
 * "rich illustrated diagram" surface for lessons that want to *show* a labelled
 * figure rather than quiz the child on it (that's `drag_label`).
 *
 * Labels are non-interactive and positioned with the same 0–100% convention as
 * DragLabel hotspots, so the same diagram coordinates work for both widgets.
 */
export function StaticDiagram({ widget }: Props) {
  const { config } = widget
  const aspectPadding = DIAGRAM_ASPECT_RATIO[config.diagram_type] ?? 100
  const labels = config.labels ?? []

  return (
    <WidgetWrapper title={config.title}>
      <figure className="m-0">
        <div
          className="relative mx-auto w-full select-none"
          style={{
            maxWidth: '340px',
            height: `${Math.min((aspectPadding / 100) * 340, 280)}px`,
          }}
        >
          {/* SVG fills the box */}
          <div className="absolute inset-0">{getDiagramSvg(config.diagram_type)}</div>

          {/* Static annotation pins */}
          {labels.map((label, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${label.x}%`, top: `${label.y}%` }}
            >
              <span className="flex items-center gap-1">
                <span className="block h-2 w-2 shrink-0 rounded-full bg-maths ring-2 ring-white" aria-hidden />
                <span className="whitespace-nowrap rounded-md border border-black/5 bg-surface/90 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-ink shadow-sm">
                  {label.text}
                </span>
              </span>
            </div>
          ))}
        </div>

        {config.caption && (
          <figcaption className="mt-3 text-center text-sm text-muted">{config.caption}</figcaption>
        )}
      </figure>
    </WidgetWrapper>
  )
}
