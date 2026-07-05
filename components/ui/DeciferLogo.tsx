import { DeciferMark } from './DeciferMark'

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Wordmark: Geist 700, -0.02em tracking (master brand rule)
const WORDMARK_CLASS: Record<LogoSize, string> = {
  xs: 'text-[11px]',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
}

// Descriptor: Geist Mono 600, uppercase, 0.18em tracking, ink-3 (master brand rule)
const DESCRIPTOR_CLASS: Record<LogoSize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-[11px]',
  xl: 'text-xs',
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
  /** If set, shows "DECIFER" wordmark + descriptor beneath — e.g. product="Learning" */
  product?: string
  className?: string
}

export function DeciferLogo({ size = 'md', product, className = '' }: DeciferLogoProps) {
  const label = product ? `Decifer ${product}` : 'Decifer'
  return (
    <span
      className={`inline-flex items-center ${GAP[size]} ${className}`}
      aria-label={label}
    >
      <DeciferMark size={size} />
      <span className="flex flex-col leading-none" aria-hidden="true">
        {/* Wordmark: Geist 700, -0.02em */}
        <span
          className={`font-sans font-bold text-ink ${WORDMARK_CLASS[size]}`}
          style={{ letterSpacing: '-0.02em' }}
        >
          Decifer
        </span>
        {/* Descriptor: Geist Mono 600, uppercase, 0.18em, ink-3 */}
        {product && (
          <span
            className={`font-mono font-semibold uppercase text-muted ${DESCRIPTOR_CLASS[size]}`}
            style={{ letterSpacing: '0.18em' }}
          >
            {product}
          </span>
        )}
      </span>
    </span>
  )
}
