// Instant skeleton shown while any admin page data loads.
// Next.js streams this immediately — users see structure before DB queries finish.
export default function AdminLoading() {
  return (
    <section className="space-y-4 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-black/[0.06]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
            <div className="h-7 w-10 rounded bg-black/[0.06] mx-auto mb-1.5" />
            <div className="h-3 w-20 rounded bg-black/[0.04] mx-auto" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm h-14" />
        ))}
      </div>
    </section>
  )
}
