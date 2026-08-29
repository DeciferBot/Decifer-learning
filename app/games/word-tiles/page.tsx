import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
import { GamePageIntro } from '@/components/games/GamePageIntro'
import { gamePageSchema } from '@/lib/games/schema'
import { WordTilesGame } from '@/components/games/WordTilesGame'

export const metadata: Metadata = {
  title: { absolute: 'Free Word Tile Game Online: Play vs Computer or a Friend' },
  description:
    'A free word-building tile game in the classic style. Play against the computer on three difficulty levels, or online with a friend via an invite code. No sign-up, no app to install.',
  alternates: { canonical: '/games/word-tiles' },
  openGraph: {
    title: 'Free Word Tile Game Online | Decifer Learning',
    description: 'Build words on a shared board against the computer or a friend. Free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/word-tiles',
  },
  twitter: {
    title: 'Free Word Tile Game Online | Decifer Learning',
    description: 'Build words on a shared board against the computer or a friend. Free, no sign-up required.',
  },
}

const schema = gamePageSchema({
  name: 'Word Tiles',
  slug: 'word-tiles',
  description: 'A free word-building tile game in the classic style. Play against the computer on three difficulty levels, or online with a friend via an invite code. No sign-up, no app to install.',
  genre: 'Word game',
  playMode: ['SinglePlayer', 'MultiPlayer'],
})

export default function PublicWordTilesPage() {
  return (
    <div className="space-y-5">
      {/* The heading block is handed to the game rather than stacked
          above it: on a wide screen it becomes the left column. See
          GameColumns in GameChrome. */}
      <WordTilesGame
        backHref="/games"
        intro={<GamePageIntro id="word-tiles" title="Free Word Tile Game, Play the Computer or a Friend" />}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
    </div>
  )
}
