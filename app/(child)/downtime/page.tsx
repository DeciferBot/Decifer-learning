import Link from 'next/link'
import { Gamepad } from '@/components/ui/icons'

export const metadata = { title: 'Downtime' }

// A small, deliberately separate catalogue of just-for-fun games — no
// points, no curriculum content, nothing to pass or fail. For when a child
// opens the app and doesn't want to study right now. Single-player against
// the computer today; each game's own page also offers this — invite-code
// play with a friend is the natural next step, not yet built.
const GAMES = [
  {
    href: '/downtime/chess',
    emoji: '♟️',
    name: 'Chess',
    blurb: 'The classic. Play the computer at three difficulty levels.',
  },
  {
    href: '/downtime/connect4',
    emoji: '🔴',
    name: 'Connect 4',
    blurb: 'Line up four in a row before the computer does.',
  },
  {
    href: '/downtime/checkers',
    emoji: '⚫',
    name: 'Checkers',
    blurb: 'Jump your way across the board and crown some kings.',
  },
]

export default function DowntimePage() {
  return (
    <div className="mx-auto max-w-md space-y-5">
      <header className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600">
          <Gamepad className="h-4 w-4" aria-hidden /> Downtime
        </div>
        <h1 className="font-heading text-2xl font-extrabold text-ink">Just for fun</h1>
        <p className="mt-1 text-sm text-muted">No points, no pressure — pick a game.</p>
      </header>

      <div className="space-y-3">
        {GAMES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="flex items-center gap-4 rounded-2xl border border-black/5 bg-surface p-4 shadow-sm transition-colors hover:bg-black/[0.02]"
          >
            <span className="text-4xl" aria-hidden>{g.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-ink">{g.name}</p>
              <p className="text-xs text-muted">{g.blurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
