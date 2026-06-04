// Two offset angle brackets — the DECIFER master mark.
// ViewBox 0 0 120 120 per master brand guide. Ember #FB5A24, strokeWidth 13.

export const EMBER = '#FB5A24'

type MarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<MarkSize, number> = {
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
  color = EMBER,
  className = '',
  standalone = false,
}: DeciferMarkProps) {
  const px = SIZE[size]

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden={!standalone}
      className={className}
    >
      <path
        d="M46 18L16 54L46 90"
        stroke={color}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 30L104 66L74 102"
        stroke={color}
        strokeWidth="13"
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
