import Link from 'next/link'
import { Gamepad, Swords, Star, ArrowRight } from '@/components/ui/icons'

export const metadata = { title: 'Games' }

// The one place a child goes to pick something to play. Before this existed as
// a surface, the only way in was a small tile buried near the bottom of
// /dashboard/child, so most of what is playable here was effectively
// undiscoverable. Everything on this page is content that already shipped —
// this is the picker, not new game logic.
//
// Two groups, because "who am I playing with" is the question a child actually
// has: something live against other people, or something quiet on their own.

// Live / points-earning play. These belong to the learning loop and are listed
// first because they are the ones with a reason to come back tomorrow.
const FEATURED = [
  {
    href: '/play',
    Icon: Swords,
    name: 'Quiz Battle',
    blurb: 'Race your friends in a live quiz.',
    gradient: 'linear-gradient(135deg, #1a237e 0%, #283593 55%, #3949ab 100%)',
  },
  {
    href: '/daily-challenge',
    Icon: Star,
    name: 'Daily Challenge',
    blurb: 'Three fresh questions, every day.',
    gradient: 'linear-gradient(135deg, #4a1942 0%, #6d3b47 55%, #7b4b6b 100%)',
  },
] as const

// Decifer Downtime — just-for-fun board games. No points, no curriculum
// content, nothing to pass or fail. Chess, Connect 4 and Checkers default to
// single-player against the computer, with "play a friend" (invite code) as a
// one-tap secondary option. Crossword is solo — a fresh puzzle every time via
// lib/games/crossword-generator.ts. Word Tiles is two-player.
const DOWNTIME = [
  {
    href: '/downtime/chess',
    emoji: '♟️',
    name: 'Chess',
    mode: 'vs computer',
    blurb: 'Three difficulty levels.',
  },
  {
    href: '/downtime/connect4',
    emoji: '🔴',
    name: 'Connect 4',
    mode: 'vs computer',
    blurb: 'Four in a row wins.',
  },
  {
    href: '/downtime/checkers',
    emoji: '⚫',
    name: 'Checkers',
    mode: 'vs computer',
    blurb: 'Jump across and crown kings.',
  },
  {
    href: '/downtime/crossword',
    emoji: '📝',
    name: 'Crossword',
    mode: 'on your own',
    blurb: 'A fresh puzzle every time.',
  },
  {
    href: '/downtime/word-tiles',
    emoji: '🔤',
    name: 'Word Tiles',
    mode: 'with a friend',
    blurb: 'Most points wins.',
  },
] as const

export default function GamesPage() {
  return (
    <section className="mx-auto max-w-md space-y-6 pb-4">
      <header className="pt-1">
        <div className="mb-1 flex items-center gap-2">
          <Gamepad className="h-6 w-6 text-brand" aria-hidden />
          <h1 className="font-heading text-2xl font-extrabold text-ink">Games</h1>
        </div>
        <p className="text-sm leading-snug text-muted">
          Pick something to play — on your own, or against someone else.
        </p>
      </header>

      {/* ── Live play ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {FEATURED.map(({ href, Icon, name, blurb, gradient }) => (
          <Link
            key={href}
            href={href}
            className="relative flex min-h-[76px] items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 text-white transition-transform active:scale-[0.98]"
            style={{ background: gradient, border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <div
              className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl"
              style={{ background: 'white' }}
              aria-hidden
            />
            <div className="relative flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/20">
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="font-heading text-base font-extrabold leading-tight">{name}</p>
              <p className="text-sm text-white/85">{blurb}</p>
            </div>
            <ArrowRight className="relative h-5 w-5 flex-none" aria-hidden />
          </Link>
        ))}
      </div>

      {/* ── Decifer Downtime board games ───────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-extrabold text-ink">Just for fun</h2>
          <p className="text-xs text-muted">No points, no pressure — Decifer Downtime.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {DOWNTIME.map(({ href, emoji, name, mode, blurb }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-[124px] flex-col items-center justify-center gap-1 rounded-2xl border border-black/5 bg-surface px-3 py-4 text-center shadow-sm transition-colors hover:bg-black/[0.02] active:scale-[0.98]"
            >
              <span className="text-4xl" aria-hidden>{emoji}</span>
              <p className="font-heading text-sm font-bold text-ink">{name}</p>
              <p className="text-[11px] font-semibold text-brand">{mode}</p>
              <p className="text-[11px] leading-tight text-muted">{blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
