import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
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
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Play Checkers Online Free</h1>
        <p className="mt-1 text-sm text-muted">
          Standard rules, mandatory captures. Play the computer or share an invite code to play
          a friend. No account needed.
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
      <CheckersGame backHref="/games" />
    </div>
  )
}
