import Link from 'next/link'
import { DeciferMark } from '@/components/ui/DeciferMark'

export const metadata = {
  title: 'Help — Decifer Learning',
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/">
            <DeciferMark size="sm" />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-brand hover:underline"
          >
            Back to dashboard →
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {children}
      </main>

      <footer className="border-t border-black/5 bg-surface py-6 text-center text-xs text-muted">
        <Link href="/" className="hover:text-ink">Decifer Learning</Link>
        {' · '}
        <Link href="/help" className="hover:text-ink">All guides</Link>
      </footer>
    </div>
  )
}
