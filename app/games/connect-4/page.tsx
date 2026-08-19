import type { Metadata } from 'next'
import { Connect4Game } from '@/components/games/Connect4Game'

export const metadata: Metadata = {
  title: 'Play Connect 4 Online Free — No Sign-Up | Decifer Learning',
  description:
    'Play Connect 4 free in your browser. Line up four in a row before the computer does, at three difficulty levels, or play a friend with an invite code. No account needed.',
  alternates: { canonical: '/games/connect-4' },
  openGraph: {
    title: 'Play Connect 4 Online Free | Decifer Learning',
    description: 'Line up four in a row — play the computer or a friend, free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/connect-4',
  },
  twitter: {
    title: 'Play Connect 4 Online Free | Decifer Learning',
    description: 'Line up four in a row — play the computer or a friend, free, no sign-up required.',
  },
}

export default function PublicConnect4Page() {
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Play Connect 4 Online Free</h1>
        <p className="mt-1 text-sm text-muted">
          Drop your pieces and line up four in a row before your opponent does. Play the
          computer or share an invite code to play a friend.
        </p>
      </div>
      <Connect4Game backHref="/games" />
    </div>
  )
}
