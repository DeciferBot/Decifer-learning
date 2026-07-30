import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'Decifer Learning · Free while in beta'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'Free while',
    headlineBottom: 'we are in beta.',
    subtitle:
      'Every subject, every year group from Year 1 to Year 11, every feature. No card required.',
    pills: ['All 5 subjects', 'Years 1 to 11', 'No card'],
  })
}
