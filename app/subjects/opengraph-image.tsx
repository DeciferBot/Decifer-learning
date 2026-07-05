import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'Decifer Learning — What we cover'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'Maths, English',
    headlineBottom: '& Science.',
    subtitle: 'UK National Curriculum from Year 1 to Year 11, across all key stages KS1 to KS4.',
    pills: ['Maths', 'English', 'Science', 'KS1–KS4'],
  })
}
