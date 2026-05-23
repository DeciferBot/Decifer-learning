// The Decifer brand mark: two offset dialogue brackets < >
// < represents the learner asking; > represents the guide responding.
// The vertical offset shows dialogue in motion.

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<Size, { bracket: string; wordmark: string; gap: string }> = {
  xs: { bracket: 'text-xl leading-none',  wordmark: 'text-xs',   gap: 'gap-1.5' },
  sm: { bracket: 'text-2xl leading-none', wordmark: 'text-sm',   gap: 'gap-2' },
  md: { bracket: 'text-3xl leading-none', wordmark: 'text-base', gap: 'gap-2' },
  lg: { bracket: 'text-4xl leading-none', wordmark: 'text-xl',   gap: 'gap-3' },
  xl: { bracket: 'text-6xl leading-none', wordmark: 'text-3xl',  gap: 'gap-4' },
}

interface DeciferMarkProps {
  size?: Size
  /** When true shows only the bracket symbol, no wordmark */
  symbolOnly?: boolean
  className?: string
}

export function DeciferMark({ size = 'md', symbolOnly = false, className = '' }: DeciferMarkProps) {
  const s = SIZE_MAP[size]

  return (
    <div className={`inline-flex items-center ${s.gap} ${className}`} aria-label="Decifer Learning">
      {/* Offset bracket symbol */}
      <span className="inline-flex items-center" aria-hidden>
        <span className={`font-heading font-black text-brand -translate-y-[0.15em] ${s.bracket}`}>
          {'<'}
        </span>
        <span className={`font-heading font-black text-brand translate-y-[0.15em] ${s.bracket}`}>
          {'>'}
        </span>
      </span>
      {!symbolOnly && (
        <span className={`font-heading font-bold text-ink ${s.wordmark}`}>
          Decifer
        </span>
      )}
    </div>
  )
}
