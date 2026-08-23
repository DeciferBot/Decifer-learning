import Link from 'next/link'
import { Gamepad, Swords, Star, ArrowRight, Trophy } from '@/components/ui/icons'
import { GAME_CATALOGUE, MODE_LABEL } from '@/lib/games/catalogue'
import { GameCard, GameTable } from '@/components/games/GameCard'
import { getAuthedProfile } from '@/lib/downtime/server'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Games' }
export const dynamic = 'force-dynamic'

// The one place a child goes to pick something to play. Before this existed as
// a surface, the only way in was a small tile buried near the bottom of
// /dashboard/child, so most of what is playable here was effectively
// undiscoverable. Everything on this page is content that already shipped —
// this is the picker, not new game logic.
//
// Two groups, because "who am I playing with" is the question a child actually
// has: something live against other people, or something quiet on their own.
//
// The board games themselves come from lib/games/catalogue.ts, shared with the
// public /games pages. They used to be a second hardcoded list here, which had
// already drifted: the same game carried a different blurb on each surface.

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

const OUTCOME_LABEL: Record<string, { text: string; colour: string }> = {
  win: { text: 'Won', colour: 'var(--correct)' },
  loss: { text: 'Lost', colour: 'var(--incorrect)' },
  draw: { text: 'Draw', colour: 'rgb(var(--tw-ink) / 0.6)' },
}

const DIFFICULTY_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function whenLabel(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function GamesPage() {
  // Every finished game a logged-in child plays lands in downtime_results
  // (see /api/downtime/results) — this is where that history surfaces.
  // fail-open: a DB hiccup hides the list rather than breaking the picker.
  let recent: {
    id: string
    game_type: string
    mode: string
    difficulty: string | null
    outcome: string
    score: number | null
    created_at: Date
  }[] = []
  try {
    const profile = await getAuthedProfile()
    if (profile) {
      recent = await prisma.downtimeResult.findMany({
        where: { profile_id: profile.id },
        orderBy: { created_at: 'desc' },
        take: 6,
        select: {
          id: true, game_type: true, mode: true, difficulty: true,
          outcome: true, score: true, created_at: true,
        },
      })
    }
  } catch {
    recent = []
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6 pb-4">
      <header className="pt-1">
        <div className="mb-1 flex items-center gap-2">
          <Gamepad className="h-6 w-6 text-brand-700" aria-hidden />
          <h1 className="font-heading text-2xl font-extrabold tracking-[-0.02em] text-ink">Games</h1>
        </div>
        <p className="text-sm leading-snug text-ink-2">
          Pick something to play, on your own or against someone else.
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
          <p className="text-xs text-muted">No points, no pressure. Decifer Downtime.</p>
        </div>

        <GameTable>
          {GAME_CATALOGUE.map((g) => (
            <GameCard key={g.id} game={g} href={`/downtime/${g.appSlug}`} />
          ))}
        </GameTable>
      </div>

      {/* ── Recent game history ────────────────────────────────────────── */}
      {recent.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-points-gold" aria-hidden />
            <h2 className="font-heading text-lg font-extrabold text-ink">Your recent games</h2>
          </div>
          <ul className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.07] bg-surface shadow-sm">
            {recent.map((r) => {
              const game = GAME_CATALOGUE.find((g) => g.id === r.game_type)
              const outcome = OUTCOME_LABEL[r.outcome] ?? OUTCOME_LABEL.draw
              const context = [
                r.difficulty ? DIFFICULTY_LABEL[r.difficulty] : null,
                MODE_LABEL[r.mode as keyof typeof MODE_LABEL] ?? null,
                r.score != null ? `${r.score} points` : null,
              ].filter(Boolean).join(' · ')
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="w-12 shrink-0 text-xs font-bold"
                    style={{ color: outcome.colour }}
                  >
                    {outcome.text}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {game?.name ?? r.game_type}
                    </span>
                    {context && <span className="block truncate text-xs text-muted">{context}</span>}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {whenLabel(r.created_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
