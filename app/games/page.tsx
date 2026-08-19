import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from '@/components/ui/icons'
import { jsonLd } from '@/lib/json-ld'
import { gamesIndexSchema } from '@/lib/games/schema'

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's '%s | Decifer Learning'
  // template, which was appending the brand a second time on top of the one
  // already written here.
  title: { absolute: 'Free Online Games for Kids: Chess, Checkers, Crossword & More' },
  description:
    'Play chess, checkers, Connect 4, crossword puzzles and a word-tile game free in your browser. No sign-up, no download. Works on phone, tablet and computer.',
  alternates: { canonical: '/games' },
  openGraph: {
    title: 'Free Online Games for Kids | Decifer Learning',
    description:
      'Chess, checkers, Connect 4, crossword and word-tile games. Free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games',
  },
  twitter: {
    title: 'Free Online Games for Kids | Decifer Learning',
    description:
      'Chess, checkers, Connect 4, crossword and word-tile games. Free, no sign-up required.',
  },
}

const GAMES = [
  {
    href: '/games/chess',
    emoji: '♟️',
    name: 'Chess',
    blurb: 'The classic strategy game. Play the computer at three difficulty levels, or a friend with an invite code.',
  },
  {
    href: '/games/checkers',
    emoji: '⚫',
    name: 'Checkers',
    blurb: 'Jump your way across the board and crown some kings, against the computer or a friend.',
  },
  {
    href: '/games/connect-4',
    emoji: '🔴',
    name: 'Connect 4',
    blurb: 'Line up four in a row before your opponent does.',
  },
  {
    href: '/games/crossword',
    emoji: '📝',
    name: 'Crossword',
    blurb: 'Pick a theme, Animals, Space, Under the Sea or UK Geography, and fill in a fresh puzzle every time.',
  },
  {
    href: '/games/word-tiles',
    emoji: '🔤',
    name: 'Word Tiles',
    blurb: 'A free word-tile game in the classic style. Build words on a shared board with a friend, most points wins.',
  },
]

// Slugs come off the same GAMES array the cards render from, so the ItemList
// can never list a game the page does not show.
const schema = gamesIndexSchema(
  GAMES.map((g) => ({ name: g.name, slug: g.href.replace('/games/', '') })),
)

export default function PublicGamesIndexPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="text-center">
        <h1 className="font-heading text-2xl font-extrabold text-ink sm:text-3xl">
          Free games for kids
        </h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          No sign-up, no download. Pick a game and start playing straight away, right here in
          your browser.
        </p>
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
            <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-surface p-5 text-center shadow-sm">
        <p className="font-heading font-bold text-ink">Part of Decifer Learning</p>
        <p className="mt-1 text-sm text-muted">
          These games are the just-for-fun corner of a UK-curriculum learning app for ages 6–16.
          Sign up free to unlock Maths, English, Science, History and Geography practice too.
        </p>
        <Link
          href="/register"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-maths px-6 font-heading font-bold text-white transition-opacity hover:opacity-90"
        >
          Get started free
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
