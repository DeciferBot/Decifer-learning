import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'

// Auth layout: centred card on mobile, split panel on desktop.
// Left panel shows brand identity and learning journey context.
// Right panel contains the form card passed as children.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">

      {/* ── Left panel (desktop only) ─────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-[45%] md:flex-col md:justify-between bg-brand-50 px-10 py-12">
        <Link href="/" aria-label="Decifer Learning home">
          <DeciferLogo size="md" product="Learning" />
        </Link>

        <div className="space-y-8">
          <div>
            <h1 className="font-heading text-3xl font-black text-ink leading-tight">
              Learning that<br />
              <span className="text-brand">talks back.</span>
            </h1>
            <p className="mt-4 text-muted">
              AI-assisted feedback, game-like motivation, and quality-checked curriculum content, one topic at a time.
            </p>
          </div>

          <ul className="space-y-4">
            {JOURNEY.map((step, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand/10 text-sm font-black text-brand font-heading">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{step.title}</p>
                  <p className="text-xs text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted">
          UK National Curriculum · Year 3 &amp; Year 7
        </p>
      </aside>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 md:bg-surface md:px-12">

        {/* Mobile-only brand mark */}
        <Link href="/" className="mb-6 md:hidden" aria-label="Decifer Learning home">
          <DeciferLogo size="md" product="Learning" />
        </Link>

        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-black/5 md:shadow-none md:ring-0 md:p-0">
            {children}
          </div>
        </div>
      </main>

    </div>
  )
}

const JOURNEY = [
  { title: 'Learn the idea', body: 'Clear explanations at the right level.' },
  { title: 'Practise with guidance', body: 'Build confidence before the quiz.' },
  { title: 'Take a quiz', body: 'Test understanding and earn rewards.' },
  { title: 'Build confidence', body: 'Track progress every single day.' },
]
