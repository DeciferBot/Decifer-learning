import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'DECIFER Learning — Every topic, mapped to the curriculum'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'Every topic,',
    headlineBottom: 'mapped to the curriculum.',
    subtitle:
      'Browse all Maths, English and Science topics across the UK National Curriculum, Year 1 to Year 11.',
    pills: ['Maths', 'English', 'Science', 'KS1–KS4'],
  })
}
