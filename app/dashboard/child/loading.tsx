import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* greeting */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      {/* subject blocks */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
