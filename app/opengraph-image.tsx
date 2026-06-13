import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'DECIFER Learning — UK National Curriculum for Families'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'Build confidence,',
    headlineBottom: 'one topic at a time.',
    subtitle: 'AI-assisted UK National Curriculum for Year 3 and Year 7.',
    pills: ['Year 3', 'Year 7', 'Parents', 'Progress'],
  })
}
