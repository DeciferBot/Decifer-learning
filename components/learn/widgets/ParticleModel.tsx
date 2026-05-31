'use client'
import { ParticleModelWidget } from '@/lib/learn-widgets'
import { WidgetWrapper } from './WidgetWrapper'

interface Props {
  widget: ParticleModelWidget
}

export function ParticleModel({ widget }: Props) {
  const { config } = widget
  return (
    <WidgetWrapper title={config.title}>
      <div className="flex min-h-[80px] items-center justify-center rounded-xl bg-black/5 px-4 py-6 text-center text-sm text-muted">
        <span>Particle model interactive — coming soon</span>
      </div>
    </WidgetWrapper>
  )
}
