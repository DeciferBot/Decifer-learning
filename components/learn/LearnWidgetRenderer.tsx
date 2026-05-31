'use client'
import { LearnWidget, WidgetPosition } from '@/lib/learn-widgets'
import { DragLabel } from './widgets/DragLabel'
import { ParticleModel } from './widgets/ParticleModel'

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
          case 'particle_model':
            return <ParticleModel key={i} widget={widget} />
          default:
            return null
        }
      })}
    </div>
  )
}
