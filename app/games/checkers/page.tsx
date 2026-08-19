import type { Metadata } from 'next'
import { CheckersGame } from '@/components/games/CheckersGame'

export const metadata: Metadata = {
  title: 'Play Checkers Online Free — No Sign-Up | Decifer Learning',
  description:
    'Play checkers (draughts) against the computer for free, right in your browser. Standard American rules with mandatory captures. Three difficulty levels, or play a friend with an invite code.',
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

export default function PublicCheckersPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Play Checkers Online Free</h1>
        <p className="mt-1 text-sm text-muted">
          Standard rules, mandatory captures. Play the computer or share an invite code to play
          a friend — no account needed.
        </p>
      </div>
      <CheckersGame backHref="/games" />
    </div>
  )
}
