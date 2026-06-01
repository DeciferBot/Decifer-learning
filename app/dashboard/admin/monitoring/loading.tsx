export default function MonitoringLoading() {
  return (
    <section className="space-y-6 max-w-3xl mx-auto px-4 pb-10 animate-pulse">
      <div className="h-8 w-36 rounded-lg bg-black/[0.06]" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
            <div className="h-7 w-10 rounded bg-black/[0.06] mx-auto mb-1.5" />
            <div className="h-3 w-16 rounded bg-black/[0.04] mx-auto" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm h-16" />
        ))}
      </div>
    </section>
  )
}
