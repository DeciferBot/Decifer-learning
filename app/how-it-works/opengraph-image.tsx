import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'DECIFER Learning — How it works'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderOgCard({
    headlineTop: 'A clear learning map',
    headlineBottom: 'for every child.',
    subtitle: 'See what the curriculum covers, what your child knows, and what to do next.',
    pills: ['Link your child', 'See progress', 'Next step'],
  })
}
