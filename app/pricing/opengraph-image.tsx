import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'DECIFER Learning — Simple pricing for families'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'Simple pricing',
    headlineBottom: 'for families.',
    subtitle: 'Start free with 3 Maths topics. Upgrade for unlimited Maths, English and Science.',
    pills: ['Free start', 'Family plan', 'Cancel anytime'],
  })
}
