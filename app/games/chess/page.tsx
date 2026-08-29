import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
import { GamePageIntro } from '@/components/games/GamePageIntro'
import { gamePageSchema } from '@/lib/games/schema'
import { ChessGame } from '@/components/games/ChessGame'

export const metadata: Metadata = {
  title: { absolute: 'Play Chess Online Free Against the Computer or a Friend' },
  description:
    'Play chess against the computer for free, right in your browser. Three difficulty levels, or play a friend with an invite code. No account needed.',
  alternates: { canonical: '/games/chess' },
  openGraph: {
    title: 'Play Chess Online Free | Decifer Learning',
    description: 'Play chess against the computer or a friend, free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/chess',
  },
  twitter: {
    title: 'Play Chess Online Free | Decifer Learning',
    description: 'Play chess against the computer or a friend, free, no sign-up required.',
  },
}

const schema = gamePageSchema({
  name: 'Chess',
  slug: 'chess',
  description: 'Play chess against the computer for free, right in your browser. Three difficulty levels, or play a friend with an invite code. No account needed.',
  genre: 'Strategy',
  playMode: ['SinglePlayer', 'MultiPlayer'],
})

export default function PublicChessPage() {
  return (
    <div className="space-y-5">
      {/* The heading block is handed to the game rather than stacked above
          it: on a wide screen it becomes the left of three columns, with the
          board in the middle. See GameColumns in GameChrome. */}
      <ChessGame
        backHref="/games"
        intro={<GamePageIntro id="chess" title="Play Chess Online Free" besideBoard />}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
    </div>
  )
}
