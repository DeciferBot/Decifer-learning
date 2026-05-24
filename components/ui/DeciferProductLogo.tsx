import { DeciferMark, type DeciferMarkProps } from './DeciferMark'

type LogoSize = 'xs' | 'sm' | 'md' | 'lg'

const MARK_SIZE: Record<LogoSize, DeciferMarkProps['size']> = {
  xs: 'xs',
  sm: 'xs',
  md: 'sm',
  lg: 'md',
}

const DECIFER_CLASS: Record<LogoSize, string> = {
  xs: 'text-[11px] tracking-[0.20em] font-bold',
  sm: 'text-xs tracking-[0.18em] font-bold',
  md: 'text-sm tracking-[0.16em] font-bold',
  lg: 'text-base tracking-[0.14em] font-bold',
}

const PRODUCT_CLASS: Record<LogoSize, string> = {
  xs: 'text-[11px] font-medium',
  sm: 'text-xs font-medium',
  md: 'text-sm font-medium',
  lg: 'text-base font-medium',
}

interface DeciferProductLogoProps {
  product: string
  size?: LogoSize
  className?: string
}

export function DeciferProductLogo({
  product,
  size = 'md',
  className = '',
}: DeciferProductLogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label={`DECIFER ${product}`}
    >
      <DeciferMark size={MARK_SIZE[size]} />
      <span className="leading-none">
        <span className={`font-heading text-ink ${DECIFER_CLASS[size]}`}>DECIFER</span>
        {' '}
        <span className={`font-heading text-muted ${PRODUCT_CLASS[size]}`}>{product}</span>
      </span>
    </span>
  )
}
