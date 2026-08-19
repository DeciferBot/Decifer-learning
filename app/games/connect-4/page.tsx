import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
import { GamePageIntro } from '@/components/games/GamePageIntro'
import { gamePageSchema } from '@/lib/games/schema'
import { Connect4Game } from '@/components/games/Connect4Game'

export const metadata: Metadata = {
  title: { absolute: 'Play Connect 4 Free Against the Computer or a Friend' },
  description:
    'Play Connect 4 free in your browser. Line up four in a row before the computer does, at three difficulty levels, or play a friend with an invite code.',
  alternates: { canonical: '/games/connect-4' },
  openGraph: {
    title: 'Play Connect 4 Online Free | Decifer Learning',
    description: 'Line up four in a row. Play the computer or a friend, free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/connect-4',
  },
  twitter: {
    title: 'Play Connect 4 Online Free | Decifer Learning',
    description: 'Line up four in a row. Play the computer or a friend, free, no sign-up required.',
  },
}

const schema = gamePageSchema({
  name: 'Connect 4',
  slug: 'connect-4',
  description: 'Play Connect 4 free in your browser. Line up four in a row before the computer does, at three difficulty levels, or play a friend with an invite code.',
  genre: 'Strategy',
  playMode: ['SinglePlayer', 'MultiPlayer'],
})

export default function PublicConnect4Page() {
  return (
    <div className="space-y-5">
      <GamePageIntro id="connect-4" title="Play Connect 4 Online Free" />
      <Connect4Game backHref="/games" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
    </div>
  )
}
