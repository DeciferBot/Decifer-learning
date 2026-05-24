import { DeciferMark } from './DeciferMark'

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const TEXT_CLASS: Record<LogoSize, string> = {
  xs: 'text-[11px] tracking-[0.20em]',
  sm: 'text-sm tracking-[0.18em]',
  md: 'text-base tracking-[0.16em]',
  lg: 'text-xl tracking-[0.14em]',
  xl: 'text-2xl tracking-[0.12em]',
}

const GAP: Record<LogoSize, string> = {
  xs: 'gap-1.5',
  sm: 'gap-2',
  md: 'gap-2.5',
  lg: 'gap-3',
  xl: 'gap-4',
}

interface DeciferLogoProps {
  size?: LogoSize
  /** If set, shows "DECIFER {product}" — e.g. product="Learning" */
  product?: string
  className?: string
}

export function DeciferLogo({ size = 'md', product, className = '' }: DeciferLogoProps) {
  const label = product ? `DECIFER ${product}` : 'DECIFER'
  return (
    <span
      className={`inline-flex items-center ${GAP[size]} ${className}`}
      aria-label={label}
    >
      <DeciferMark size={size} />
      <span className={`font-heading font-bold text-ink ${TEXT_CLASS[size]}`}>
        DECIFER
        {product && (
          <span className="font-medium text-muted"> {product}</span>
        )}
      </span>
    </span>
  )
}
