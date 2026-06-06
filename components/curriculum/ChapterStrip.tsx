'use client'

import { BookOpen } from '@/components/ui/icons'

export type CurriculumUnit = {
  id: string
  title: string
  description: string | null
  order_index: number
  oak_confidence: string | null
}

type Props = {
  units: CurriculumUnit[]
  subjectColor?: string
}

export function ChapterStrip({ units, subjectColor = '#6C9EFF' }: Props) {
  if (units.length === 0) return null

  return (
    <div
      className="rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm"
      style={{ borderLeft: `4px solid ${subjectColor}` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <BookOpen size={15} style={{ color: subjectColor }} aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: subjectColor }}>
          This topic covers {units.length} chapter{units.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ol className="space-y-1">
        {units.map((unit, i) => (
          <li key={unit.id} className="flex items-start gap-2">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: subjectColor, opacity: 0.85 }}
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="text-sm leading-snug text-ink">{unit.title}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
