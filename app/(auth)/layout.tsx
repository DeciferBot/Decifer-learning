// Shared layout for the auth route group: centres the auth card on every screen
// and respects the 375px iPhone SE viewport (CLAUDE.md §13).

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-maths">
            Decifer Learning
          </h1>
        </div>
        <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-black/5">
          {children}
        </div>
      </div>
    </main>
  )
}
