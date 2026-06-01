export default function UsersLoading() {
  return (
    <section className="space-y-4 animate-pulse pb-10">
      <div className="h-8 w-48 rounded-lg bg-black/[0.06]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
            <div className="h-7 w-12 rounded bg-black/[0.06] mx-auto mb-1.5" />
            <div className="h-3 w-20 rounded bg-black/[0.04] mx-auto" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm h-40" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm h-14" />
        ))}
      </div>
      <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm h-64" />
    </section>
  )
}
