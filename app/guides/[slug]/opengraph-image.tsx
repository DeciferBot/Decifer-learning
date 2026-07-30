import { ogContentType, ogSize, renderOgCard } from '@/lib/og'
import { getAllGuides, getGuide } from '@/lib/guides'
import { GUIDE_CATEGORY_LABELS } from '@/lib/guides/types'

export const alt = 'Decifer Learning · UAE parent guide'
export const size = ogSize
export const contentType = ogContentType

// Pre-render one card per guide at build time so shared links preview instantly
// and the Article schema has a real image to point at.
export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }))
}

// Split the H1 across the card's two headline lines at a natural break, so long
// titles wrap sensibly instead of overflowing one line.
function splitHeadline(h1: string): [string, string] {
  const words = h1.split(' ')
  if (words.length < 4) return [h1, '']
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

export default async function Image({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug)
  if (!guide) {
    return renderOgCard({
      headlineTop: 'UAE school guides',
      headlineBottom: 'for parents.',
      subtitle: 'Fees, ratings, term dates and the British curriculum, explained.',
      pills: ['Decifer Learning'],
    })
  }

  const [top, bottom] = splitHeadline(guide.h1)
  return renderOgCard({
    headlineTop: top,
    headlineBottom: bottom,
    subtitle: guide.description,
    pills: [GUIDE_CATEGORY_LABELS[guide.category], 'Free while in beta'],
  })
}
