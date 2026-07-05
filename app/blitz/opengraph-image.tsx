import { ogContentType, ogSize, renderBlitzOgCard } from '@/lib/og'

export const alt = 'Decifer Blitz · live quiz battles'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderBlitzOgCard()
}
