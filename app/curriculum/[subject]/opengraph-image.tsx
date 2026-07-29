import { ogContentType, ogSize, renderOgCard } from '@/lib/og'

export const alt = 'Decifer Learning · Subject curriculum'
export const size = ogSize
export const contentType = ogContentType

// Slug → display name, year span and key stages. Kept local (not a DB read) so OG
// generation stays fast and dependency-free. History and Geography stop at Year 9,
// so the span and the key-stage pills are per subject rather than one hardcoded
// "Year 1 to Year 11" and a fixed KS1-KS4 row, which would overclaim for those two.
const SUBJECTS: Record<string, { name: string; span: string; pills: string[] }> = {
  maths: { name: 'Maths', span: 'Year 1 to Year 11.', pills: ['KS1', 'KS2', 'KS3', 'KS4'] },
  english: { name: 'English', span: 'Year 1 to Year 11.', pills: ['KS1', 'KS2', 'KS3', 'KS4'] },
  science: { name: 'Science', span: 'Year 1 to Year 11.', pills: ['KS1', 'KS2', 'KS3', 'KS4'] },
  history: { name: 'History', span: 'Year 1 to Year 9.', pills: ['KS1', 'KS2', 'KS3'] },
  geography: { name: 'Geography', span: 'Year 1 to Year 9.', pills: ['KS1', 'KS2', 'KS3'] },
}

export default async function Image({ params }: { params: { subject: string } }) {
  const subject = SUBJECTS[params.subject]
  const name = subject?.name ?? 'Curriculum'

  return renderOgCard({
    headlineTop: `${name} curriculum,`,
    headlineBottom: subject?.span ?? 'Year 1 to Year 11.',
    subtitle: `Every ${name} topic, quality-checked and mapped to the UK National Curriculum.`,
    pills: subject?.pills ?? ['KS1', 'KS2', 'KS3', 'KS4'],
  })
}
