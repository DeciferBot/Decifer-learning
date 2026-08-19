import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
import { gamePageSchema } from '@/lib/games/schema'
import { WordTilesGame } from '@/components/games/WordTilesGame'

export const metadata: Metadata = {
  title: { absolute: 'Free Word Tile Game Online: Play With a Friend' },
  description:
    'A free word-building tile game in the classic style, playable online with a friend via an invite code. No sign-up, no app to install.',
  alternates: { canonical: '/games/word-tiles' },
  openGraph: {
    title: 'Free Word Tile Game Online | Decifer Learning',
    description: 'Build words on a shared board with a friend. Free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/word-tiles',
  },
  twitter: {
    title: 'Free Word Tile Game Online | Decifer Learning',
    description: 'Build words on a shared board with a friend. Free, no sign-up required.',
  },
}

const schema = gamePageSchema({
  name: 'Word Tiles',
  slug: 'word-tiles',
  description: 'A free word-building tile game in the classic style, playable online with a friend via an invite code. No sign-up, no app to install.',
  genre: 'Word game',
  playMode: ['MultiPlayer'],
})

export default function PublicWordTilesPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Free Word Tile Game, Play With a Friend</h1>
        <p className="mt-1 text-sm text-muted">
          A word-building tile game in the classic style, like Scrabble, but free with no
          sign-up. Share an invite code and build words together, most points wins.
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
      <WordTilesGame backHref="/games" />
    </div>
  )
}
