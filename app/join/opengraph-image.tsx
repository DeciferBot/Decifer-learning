import { ogContentType, ogSize, renderBlitzOgCard } from '@/lib/og'

export const alt = 'Decifer Blitz — join a live quiz battle'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return renderBlitzOgCard()
}
