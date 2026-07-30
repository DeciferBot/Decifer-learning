import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'Decifer Learning · UAE school guides for parents'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'UAE school guides',
    headlineBottom: 'for parents.',
    subtitle:
      'School fees, KHDA and ADEK ratings, term dates and the British curriculum, using public sources you can check yourself.',
    pills: ['Fees', 'Ratings', 'Term dates', 'GCSE'],
  })
}
