import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'Decifer Learning · Subject curriculum'
export const size = ogSize
export const contentType = ogContentType

// Slug → display name. Kept local (not a DB read) so OG generation stays fast and
// dependency-free; the three marketed subjects are the only public curriculum slugs.
const SUBJECT_NAMES: Record<string, string> = {
  maths: 'Maths',
  english: 'English',
  science: 'Science',
}

export default async function Image({ params }: { params: { subject: string } }) {
  const name = SUBJECT_NAMES[params.subject] ?? 'Curriculum'

  return renderOgCard({
    headlineTop: `${name} curriculum,`,
    headlineBottom: 'Year 1 to Year 11.',
    subtitle: `Every ${name} topic, quality-checked and mapped to the UK National Curriculum.`,
    pills: ['KS1', 'KS2', 'KS3', 'KS4'],
  })
}
