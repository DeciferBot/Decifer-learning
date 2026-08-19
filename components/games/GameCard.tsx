import Link from 'next/link'
import { GamePreview } from '@/components/games/GamePreview'
import { MODE_LABEL, type GameEntry } from '@/lib/games/catalogue'
import { Users, UserCircle, Brain, Clock, Sparkles } from '@/components/ui/icons'

export const MODE_ICON = { computer: Brain, friend: Users, solo: UserCircle } as const

/**
 * One game, explained.
 *
 * The pickers used to be a stack of thin rows: emoji, name, one sentence,
 * chevron. Two problems. A child could not tell Connect 4 from Checkers,
 * because both showed a red circle. And nothing on the row answered the
 * questions that decide whether you tap it: what do I actually do, can I play
 * this on my own, and how long does it take?
 *
 * So the card leads with a slice of the real board, then answers all three.
 */
export function GameCard({ game, href }: { game: GameEntry; href: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-surface shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_10px_28px_rgba(42,33,26,.14)] focus-visible:-translate-y-0.5 active:translate-y-0"
    >
      <GamePreview game={game.id} className="rounded-none" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-heading text-base font-extrabold tracking-[-0.01em] text-ink">{game.name}</h3>
          <p className="mt-0.5 text-pretty text-[13px] leading-snug text-muted">{game.blurb}</p>
        </div>

        {/* The parent's half of the card. A child scans the picture and the
            name; whoever is deciding whether this is a good use of an hour
            reads this line. */}
        <p className="flex gap-1.5 text-pretty text-xs leading-snug text-ink-2">
          <Sparkles className="mt-[1px] h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
          <span>
            <span className="sr-only">What it builds: </span>
            {game.builds}
          </span>
        </p>

        <ul className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {game.modes.map((m) => {
            const Icon = MODE_ICON[m]
            return (
              <li
                key={m}
                className="inline-flex items-center gap-1 rounded-full bg-brand/[0.08] px-2 py-1 text-[11px] font-semibold text-brand-700"
              >
                <Icon className="h-3 w-3" aria-hidden /> {MODE_LABEL[m]}
              </li>
            )
          })}
          <li className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-1 text-[11px] font-semibold text-ink-2">
            <Clock className="h-3 w-3" aria-hidden /> {game.minutes}
          </li>
        </ul>
      </div>
    </Link>
  )
}

/**
 * The table the cards sit on. This is the whole "you are somewhere else now"
 * move: the learning app is warm paper, the games room is a dark walnut
 * surface, and each game is a lit object resting on it.
 */
export function GameTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-2.5 sm:p-4"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 0%, var(--game-table-lit) 0%, var(--game-table) 55%, var(--game-table-far) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,235,210,.14), inset 0 -2px 12px rgba(0,0,0,.5)',
      }}
    >
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 235px), 1fr))' }}
      >
        {children}
      </div>
    </div>
  )
}
