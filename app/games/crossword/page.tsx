import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
import { GamePageIntro } from '@/components/games/GamePageIntro'
import { gamePageSchema } from '@/lib/games/schema'
import { CrosswordGame } from '@/components/games/CrosswordGame'

export const metadata: Metadata = {
  title: { absolute: 'Free Crossword Puzzles for Kids: New Puzzle Every Time' },
  description:
    'Free crossword puzzles for kids in your browser. Pick a theme, Animals, Space, Under the Sea or UK Geography, and get a fresh puzzle every time.',
  alternates: { canonical: '/games/crossword' },
  openGraph: {
    title: 'Free Crossword Puzzles for Kids | Decifer Learning',
    description: 'A fresh, themed crossword puzzle every time. Free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/crossword',
  },
  twitter: {
    title: 'Free Crossword Puzzles for Kids | Decifer Learning',
    description: 'A fresh, themed crossword puzzle every time. Free, no sign-up required.',
  },
}

const schema = gamePageSchema({
  name: 'Crossword',
  slug: 'crossword',
  description: 'Free crossword puzzles for kids in your browser. Pick a theme, Animals, Space, Under the Sea or UK Geography, and get a fresh puzzle every time.',
  genre: 'Puzzle',
  playMode: ['SinglePlayer'],
})

export default function PublicCrosswordPage() {
  return (
    <div className="space-y-5">
      <GamePageIntro id="crossword" title="Free Crossword Puzzles for Kids" />
      <CrosswordGame backHref="/games" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
    </div>
  )
}
