'use client'
import { LearnWidget, SentenceBuilderWidget, WidgetPosition } from '@/lib/learn-widgets'
import { DragLabel } from './widgets/DragLabel'
import { StaticDiagram } from './widgets/StaticDiagram'
import { ParticleModel } from './widgets/ParticleModel'
import { SentenceBuilder } from './widgets/SentenceBuilder'

interface Props {
  widgets: LearnWidget[]
  position: WidgetPosition
}

export function LearnWidgetRenderer({ widgets, position }: Props) {
  const forPosition = widgets.filter(w => w.position === position)
  if (!forPosition.length) return null

  return (
    <div className="space-y-4">
      {forPosition.map((widget, i) => {
        switch (widget.type) {
          case 'drag_label':
            return <DragLabel key={i} widget={widget} />
          case 'diagram':
            return <StaticDiagram key={i} widget={widget} />
          case 'particle_model':
            return <ParticleModel key={i} widget={widget} />
          case 'sentence_builder':
            return <SentenceBuilder key={i} widget={widget as SentenceBuilderWidget} />
          default:
            return null
        }
      })}
    </div>
  )
}
