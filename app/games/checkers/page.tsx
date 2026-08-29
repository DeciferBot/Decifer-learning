import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
import { GamePageIntro } from '@/components/games/GamePageIntro'
import { gamePageSchema } from '@/lib/games/schema'
import { CheckersGame } from '@/components/games/CheckersGame'

export const metadata: Metadata = {
  title: { absolute: 'Play Checkers Online Free Against the Computer or a Friend' },
  description:
    'Play checkers (draughts) against the computer for free in your browser. Standard American rules with mandatory captures. Three difficulty levels.',
  alternates: { canonical: '/games/checkers' },
  openGraph: {
    title: 'Play Checkers Online Free | Decifer Learning',
    description: 'Play checkers against the computer or a friend, free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/checkers',
  },
  twitter: {
    title: 'Play Checkers Online Free | Decifer Learning',
    description: 'Play checkers against the computer or a friend, free, no sign-up required.',
  },
}

const schema = gamePageSchema({
  name: 'Checkers',
  slug: 'checkers',
  description: 'Play checkers (draughts) against the computer for free in your browser. Standard American rules with mandatory captures. Three difficulty levels.',
  genre: 'Strategy',
  playMode: ['SinglePlayer', 'MultiPlayer'],
})

export default function PublicCheckersPage() {
  return (
    <div className="space-y-5">
      {/* The heading block is handed to the game rather than stacked
          above it: on a wide screen it becomes the left column. See
          GameColumns in GameChrome. */}
      <CheckersGame
        backHref="/games"
        intro={<GamePageIntro id="checkers" title="Play Checkers Online Free" besideBoard />}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
    </div>
  )
}
