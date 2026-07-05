import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/">
            <DeciferLogo size="sm" product="Learning" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-black/5"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 bg-surface py-6 text-center text-xs text-muted">
        <Link href="/" className="hover:text-ink">Decifer Learning</Link>
        {' · '}
        <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
        {' · '}
        <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
        {' · '}
        <Link href="/help" className="hover:text-ink">Help</Link>
      </footer>

    </div>
  )
}
