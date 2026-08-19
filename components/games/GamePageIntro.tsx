import { GamePreview } from '@/components/games/GamePreview'
import { GAME_CATALOGUE, MODE_LABEL, type GameEntry } from '@/lib/games/catalogue'
import { MODE_ICON } from '@/components/games/GameCard'
import { Clock, Sparkles } from '@/components/ui/icons'

/**
 * The heading block on a public /games/<slug> page.
 *
 * It owns the page's only <h1>. The game component below it renders its menu
 * title as an <h2> on these routes (see `menuHeadingLevel` in GameChrome) —
 * before this, the page and the game each emitted an <h1>, so every public
 * game page shipped two competing top-level headings.
 *
 * The rules line matters beyond SEO: this page is the first thing a child
 * arriving from a search result sees, and "how do I take a turn" is the
 * question they have before they have one.
 */
export function GamePageIntro({ id, title }: { id: GameEntry['id']; title: string }) {
  const game = GAME_CATALOGUE.find((g) => g.id === id)
  if (!game) return null

  return (
    <header className="mx-auto max-w-md text-center">
      {/* The same slice of board the picker card showed, so arriving here
          from /games feels like walking up to the thing you just chose.
          Full height on purpose: capping it clipped the bottom row of squares
          part-way through, which read as a rendering fault rather than a
          crop. */}
      <GamePreview game={id} className="mb-4" />
      <h1 className="text-balance font-heading text-2xl font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-[44ch] text-pretty text-sm text-ink-2">{game.howToPlay}</p>
      <p className="mx-auto mt-2 flex max-w-[44ch] items-start justify-center gap-1.5 text-pretty text-xs text-muted">
        <Sparkles className="mt-[1px] h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
        <span>
          <span className="sr-only">What it builds: </span>
          {game.builds}
        </span>
      </p>
      <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
        {game.modes.map((m) => {
          const Icon = MODE_ICON[m]
          return (
            <li
              key={m}
              className="inline-flex items-center gap-1 rounded-full bg-brand/[0.08] px-2.5 py-1 text-[11px] font-semibold text-brand-700"
            >
              <Icon className="h-3 w-3" aria-hidden /> {MODE_LABEL[m]}
            </li>
          )
        })}
        <li className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-2">
          <Clock className="h-3 w-3" aria-hidden /> {game.minutes}
        </li>
      </ul>
    </header>
  )
}
