// Two opposing dialogue brackets — the DECIFER master mark.
// Left bracket offset up, right bracket offset down. Both orange.
// ViewBox 40×32: 10% vertical offset (2 units each side of centre).

export const MARK_ORANGE = '#F05A28'

type MarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const HEIGHT: Record<MarkSize, number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 30,
  xl: 44,
}

export interface DeciferMarkProps {
  size?: MarkSize
  color?: string
  className?: string
  /** When true, wraps in a span with aria-label for standalone use */
  standalone?: boolean
}

export function DeciferMark({
  size = 'md',
  color = MARK_ORANGE,
  className = '',
  standalone = false,
}: DeciferMarkProps) {
  const h = HEIGHT[size]
  const w = Math.round(h * 40 / 32)

  const svg = (
    <svg
      width={w}
      height={h}
      viewBox="0 0 40 32"
      fill="none"
      aria-hidden={!standalone}
      className={className}
    >
      <polyline
        points="13,5 5,15 13,25"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="27,7 35,17 27,27"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (standalone) {
    return <span aria-label="DECIFER Learning">{svg}</span>
  }
  return svg
}
