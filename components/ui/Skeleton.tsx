export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-black/8 ${className}`}
      aria-hidden="true"
    />
  )
}
