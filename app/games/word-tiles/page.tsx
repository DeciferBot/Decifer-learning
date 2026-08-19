import type { Metadata } from 'next'
import { WordTilesGame } from '@/components/games/WordTilesGame'

export const metadata: Metadata = {
  title: 'Free Word Tile Game Online — Play With a Friend | Decifer Learning',
  description:
    'A free word-building tile game in the classic style, playable online with a friend via an invite code — no sign-up, no app to install. Build words on a shared board, most points wins.',
  alternates: { canonical: '/games/word-tiles' },
  openGraph: {
    title: 'Free Word Tile Game Online | Decifer Learning',
    description: 'Build words on a shared board with a friend — free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/word-tiles',
  },
  twitter: {
    title: 'Free Word Tile Game Online | Decifer Learning',
    description: 'Build words on a shared board with a friend — free, no sign-up required.',
  },
}

export default function PublicWordTilesPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Free Word Tile Game — Play With a Friend</h1>
        <p className="mt-1 text-sm text-muted">
          A word-building tile game in the classic style — like Scrabble, but free with no
          sign-up. Share an invite code and build words together, most points wins.
        </p>
      </div>
      <WordTilesGame backHref="/games" />
    </div>
  )
}
