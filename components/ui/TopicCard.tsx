import Link from 'next/link'
import { Lock, Star } from '@/components/ui/icons'

interface TopicCardProps {
  id: string
  title: string
  subjectName: string
  subjectColor: string
  yearGroupLabel?: string
  description?: string
  progressPercent?: number
  xpAvailable?: number
  isLocked?: boolean
}

export function TopicCard({
  id,
  title,
  subjectName,
  subjectColor,
  yearGroupLabel,
  description,
  progressPercent,
  xpAvailable,
  isLocked = false,
}: TopicCardProps) {
  if (isLocked) {
    return (
      <div className="rounded-2xl border border-black/5 bg-surface/60 p-5 opacity-60">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-muted/40" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{subjectName}</span>
        </div>
        <h3 className="font-heading text-base font-bold text-muted">{title}</h3>
        <p className="mt-2 text-xs text-muted flex items-center gap-1"><Lock className="w-3.5 h-3.5" aria-hidden /> Complete earlier topics to unlock this one.</p>
      </div>
    )
  }

  const hasProgress = typeof progressPercent === 'number'
  const ctaLabel = !hasProgress ? 'Start' : progressPercent >= 100 ? 'Review' : 'Continue'

  return (
    <article className="rounded-2xl border border-black/5 bg-surface shadow-sm overflow-hidden">
      {/* Coloured header strip */}
      <div className="h-1 w-full" style={{ backgroundColor: subjectColor }} aria-hidden />

      <div className="p-5">
        {/* Subject + year group label */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: subjectColor }} aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wide text-muted">{subjectName}</span>
          </div>
          {yearGroupLabel && (
            <span className="text-xs text-muted">{yearGroupLabel}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-heading text-lg font-bold text-ink">{title}</h3>

        {/* Description */}
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}

        {/* Progress bar */}
        {hasProgress && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted">Progress</span>
              <span className="text-xs font-semibold text-ink">{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/[0.06]">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${progressPercent}%`, backgroundColor: subjectColor }}
              />
            </div>
          </div>
        )}

        {/* XP available */}
        {xpAvailable != null && xpAvailable > 0 && (
          <p className="mt-2 text-xs text-muted flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-points-gold" aria-hidden />
            {xpAvailable} XP available
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link
            href={`/topics/${id}/learn`}
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-maths/10 px-3 py-2 text-sm font-bold text-maths transition-colors hover:bg-maths/20"
          >
            Learn
          </Link>
          <Link
            href={`/topics/${id}/practise`}
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-science/10 px-3 py-2 text-sm font-bold text-science transition-colors hover:bg-science/20"
          >
            Practise
          </Link>
          <Link
            href={`/topics/${id}/quiz`}
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-lightning/20 px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-lightning/30"
          >
            Quiz
          </Link>
        </div>

        {/* Primary CTA */}
        <Link
          href={`/topics/${id}/learn`}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand text-sm font-bold text-white transition-colors hover:bg-brand-600"
        >
          {ctaLabel} →
        </Link>
      </div>
    </article>
  )
}
