export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-black/[0.08] ${className}`}
      aria-hidden="true"
    />
  )
}
