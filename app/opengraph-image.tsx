import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'Decifer Learning — Build confidence, one topic at a time'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'Build confidence,',
    headlineBottom: 'one topic at a time.',
    subtitle: 'The British curriculum, Years 1 to 11. Maths, English, Science, History and Geography.',
    pills: ['Years 1–11', 'KS1–GCSE', '5 subjects', 'For parents'],
  })
}
