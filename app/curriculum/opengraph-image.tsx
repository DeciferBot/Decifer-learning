import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'Decifer Learning — Every topic, mapped to the curriculum'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'Every topic,',
    headlineBottom: 'mapped to the curriculum.',
    subtitle:
      'Browse every topic across five subjects and the full UK National Curriculum, Year 1 to Year 11.',
    pills: ['5 subjects', 'Years 1–11', 'KS1–GCSE'],
  })
}
