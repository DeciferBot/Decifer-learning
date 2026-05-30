import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  heading: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ icon, heading, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-surface px-6 py-12 text-center">
      {icon && (
        <span className="mb-4 flex items-center justify-center" aria-hidden>{icon}</span>
      )}
      <p className="font-heading text-lg font-semibold text-ink">{heading}</p>
      {body && (
        <p className="mt-2 max-w-xs text-sm text-muted">{body}</p>
      )}
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  )
}
