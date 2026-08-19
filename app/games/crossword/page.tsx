import type { Metadata } from 'next'
import { CrosswordGame } from '@/components/games/CrosswordGame'

export const metadata: Metadata = {
  title: 'Free Crossword Puzzles for Kids — New Puzzle Every Time | Decifer Learning',
  description:
    'Free crossword puzzles for kids, right in your browser. Pick a theme — Animals, Space, Under the Sea, UK Geography — and get a freshly generated puzzle every time. No sign-up, no printing.',
  alternates: { canonical: '/games/crossword' },
  openGraph: {
    title: 'Free Crossword Puzzles for Kids | Decifer Learning',
    description: 'A fresh, themed crossword puzzle every time — free, no sign-up required.',
    url: 'https://www.deciferlearning.com/games/crossword',
  },
  twitter: {
    title: 'Free Crossword Puzzles for Kids | Decifer Learning',
    description: 'A fresh, themed crossword puzzle every time — free, no sign-up required.',
  },
}

export default function PublicCrosswordPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-sm text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Free Crossword Puzzles for Kids</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a theme and get a freshly built puzzle every time — never the same grid twice.
          No printing, no account needed.
        </p>
      </div>
      <CrosswordGame backHref="/games" />
    </div>
  )
}
