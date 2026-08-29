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
export function GamePageIntro({
  id,
  title,
  besideBoard,
}: {
  id: GameEntry['id']
  title: string
  /** Set when this block shares a page with the game's real board. The
   *  decorative board slice is then dropped entirely: on a wide screen it
   *  sits an inch from an actual chessboard and reads as a mistake, and on a
   *  phone it filled the first screen so the real board started below the
   *  fold. It stays on the pages whose board only appears after a choice. */
  besideBoard?: boolean
}) {
  const game = GAME_CATALOGUE.find((g) => g.id === id)
  if (!game) return null

  // Centred when this block is the whole top of the page. Left-aligned from
  // `lg` only in the wide layout, where it is a narrow left column beside the
  // board and centred text there reads as ragged on both edges.
  const wide = besideBoard ? 'lg:mx-0 lg:text-left' : ''
  const wideStart = besideBoard ? 'lg:mx-0 lg:justify-start' : ''

  return (
    <header className={`mx-auto max-w-md text-center ${wide}`}>
      {/* The same slice of board the picker card showed, so arriving here
          from /games feels like walking up to the thing you just chose.
          Full height on purpose: capping it clipped the bottom row of squares
          part-way through, which read as a rendering fault rather than a
          crop. */}
      {!besideBoard && <GamePreview game={id} className="mb-4" />}
      <h1 className="text-balance font-heading text-2xl font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <p className={`mx-auto mt-2 max-w-[44ch] text-pretty text-sm text-ink-2 ${wide}`}>{game.howToPlay}</p>
      <p className={`mx-auto mt-2 flex max-w-[44ch] items-start justify-center gap-1.5 text-pretty text-xs text-muted ${wideStart}`}>
        <Sparkles className="mt-[1px] h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
        <span>
          <span className="sr-only">What it builds: </span>
          {game.builds}
        </span>
      </p>
      <ul className={`mt-3 flex flex-wrap justify-center gap-1.5 ${besideBoard ? 'lg:justify-start' : ''}`}>
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
