import type { Metadata } from 'next'
import { jsonLd } from '@/lib/json-ld'
import { gamePageSchema } from '@/lib/games/schema'
import { ChessGame } from '@/components/games/ChessGame'

export const metadata: Metadata = {
  title: { absolute: 'Play Chess Online Free: No Sign-Up' },
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
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Play Chess Online Free</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a difficulty and play the computer, or share an invite code to play a friend.
          Works on phone, tablet or computer, no account needed.
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
      <ChessGame backHref="/games" />
    </div>
  )
}
