import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingNav } from '@/components/marketing/MarketingNav'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <MarketingNav />

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      {/* family={false}: this layout also wraps /legal/privacy-for-kids, which is
          written for children. The sibling-brand row stays off child-facing pages. */}
      <MarketingFooter family={false} />

    </div>
  )
}
