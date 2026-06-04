import { Star } from '@/components/ui/icons'

interface XPBadgeProps {
  points: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'gold' | 'brand' | 'muted'
}

const VARIANT_STYLES = {
  gold:  'bg-points-gold/15 text-amber-700 border-points-gold/30',
  brand: 'bg-brand-50 text-brand-600 border-brand/20',
  muted: 'bg-black/[0.04] text-muted border-black/10',
}

const SIZE_STYLES = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
  lg: 'px-3 py-1.5 text-base gap-2',
}

export function XPBadge({ points, size = 'md', variant = 'gold' }: XPBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold font-heading ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]}`}
      aria-label={`${points} XP`}
    >
      <Star className="w-3.5 h-3.5" aria-hidden />
      <span>{points.toLocaleString()} XP</span>
    </span>
  )
}
