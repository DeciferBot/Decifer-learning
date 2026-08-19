import type { Metadata } from 'next'
import Link from 'next/link'
import { jsonLd } from '@/lib/json-ld'
import { gamesIndexSchema } from '@/lib/games/schema'
import { GAME_CATALOGUE } from '@/lib/games/catalogue'
import { GameCard, GameTable } from '@/components/games/GameCard'

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's '%s | Decifer Learning'
  // template, which was appending the brand a second time on top of the one
  // already written here.
  title: { absolute: 'Free Online Games for Kids: Chess, Checkers, Crossword & More' },
  description:
    'Chess, checkers, Connect 4, crosswords and word games, free in your browser. No sign-up, no adverts, nothing to buy. Classic games that build planning, spelling and vocabulary, from a UK-curriculum learning app.',
  alternates: { canonical: '/games' },
  openGraph: {
    title: 'Free Online Games for Kids | Decifer Learning',
    description:
      'Classic games kids actually want to play, and parents are happy to say yes to. Free, no sign-up, no adverts.',
    url: 'https://www.deciferlearning.com/games',
  },
  twitter: {
    title: 'Free Online Games for Kids | Decifer Learning',
    description:
      'Classic games kids actually want to play, and parents are happy to say yes to. Free, no sign-up, no adverts.',
  },
}

// The ItemList comes off the same catalogue the cards render from, so it can
// never list a game the page does not show.
const schema = gamesIndexSchema(
  GAME_CATALOGUE.map((g) => ({ name: g.name, slug: g.publicSlug })),
)

export default function PublicGamesIndexPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* The headline deliberately never counts the games. It used to open
          "Five games", which meant the sixth game would have shipped with a
          lie at the top of the page. */}
      <header className="mx-auto max-w-xl text-center">
        <h1 className="text-balance font-heading text-[1.75rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink sm:text-4xl">
          Free games for kids that earn their screen time
        </h1>
        <p className="mx-auto mt-3 max-w-[48ch] text-pretty text-[15px] leading-relaxed text-ink-2 sm:text-base">
          Chess, crosswords and the other classics that have kept children thinking for
          generations. Your child picks what they want to play. You get to stop negotiating about
          it. No sign-up, no adverts, nothing to buy.
        </p>
      </header>

      <GameTable>
        {GAME_CATALOGUE.map((g) => (
          <GameCard key={g.id} game={g} href={`/games/${g.publicSlug}`} />
        ))}
      </GameTable>

      <div className="rounded-2xl border border-black/[0.07] bg-surface p-6 text-center shadow-sm">
        <p className="font-heading text-lg font-extrabold tracking-[-0.01em] text-ink">
          Made by people who build lessons for a living
        </p>
        <p className="mx-auto mt-2 max-w-[54ch] text-pretty text-sm leading-relaxed text-ink-2">
          Decifer Learning teaches the UK curriculum to children aged 6 to 16, and these games are
          the corner of it where nothing is being marked. The same free account opens Maths,
          English, Science, History and Geography, written to the same standard: something a child
          will sit down and finish.
        </p>
        <Link
          href="/register"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-6 font-heading font-bold text-white transition-colors hover:bg-brand-700"
        >
          Start free
        </Link>
      </div>

      {/* Last child on purpose. This wrapper uses Tailwind's `space-y-6`,
          which sets margin-top on every child after the first via
          `> :not([hidden]) ~ :not([hidden])`. A <script> is not [hidden], so
          putting it first pushed <header> into the "not first" slot and gave
          the page an unintended 24px gap above the heading. Rendered last, it
          displaces nothing: it is display:none, so the margin it picks up is
          inert. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
    </div>
  )
}
