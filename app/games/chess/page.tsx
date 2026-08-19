import type { Metadata } from 'next'
import { ChessGame } from '@/components/games/ChessGame'

export const metadata: Metadata = {
  title: 'Play Chess Online Free — No Sign-Up | Decifer Learning',
  description:
    'Play chess against the computer for free, right in your browser. Three difficulty levels for beginners through to a real challenge, or play a friend with an invite code. No account needed.',
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

export default function PublicChessPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Play Chess Online Free</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a difficulty and play the computer, or share an invite code to play a friend.
          Works on phone, tablet or computer — no account needed.
        </p>
      </div>
      <ChessGame backHref="/games" />
    </div>
  )
}
