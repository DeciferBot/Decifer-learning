import type { Metadata } from 'next'
import Link from 'next/link'
import { DeciferLogo } from '@/components/ui/DeciferLogo'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'

export const metadata: Metadata = {
  title: 'What we cover — Decifer Learning',
  description:
    'The British curriculum across five subjects. Maths, English and Science from Year 1 to GCSE (KS1–KS4), plus History and Geography to Year 9. UK National Curriculum, quality-checked.',
  alternates: { canonical: '/subjects' },
}

const SUBJECTS = [
  {
    name: 'Maths',
    colour: 'text-maths border-maths/30 bg-maths/5',
    badge: 'bg-maths text-white',
    years: [
      { label: 'Year 1–2', stage: 'KS1', topics: 'Numbers, shapes, measures, time' },
      { label: 'Year 3–6', stage: 'KS2', topics: 'Multiplication, fractions, decimals, geometry, statistics' },
      { label: 'Year 7–9', stage: 'KS3', topics: 'Algebra, ratio, probability, trigonometry' },
      { label: 'Year 10–11', stage: 'KS4 (GCSE)', topics: 'Quadratics, circle theorems, vectors, simultaneous equations (AQA and Edexcel)' },
    ],
  },
  {
    name: 'English',
    colour: 'text-english border-english/30 bg-english/5',
    badge: 'bg-english text-white',
    years: [
      { label: 'Year 1–2', stage: 'KS1', topics: 'Phonics, reading comprehension, simple writing' },
      { label: 'Year 3–6', stage: 'KS2', topics: 'Grammar, punctuation, poetry, narrative writing' },
      { label: 'Year 7–9', stage: 'KS3', topics: 'Analytical writing, Shakespeare, comparing texts' },
      { label: 'Year 10–11', stage: 'KS4 (GCSE)', topics: 'Macbeth, An Inspector Calls, language analysis, exam technique (AQA and Edexcel)' },
    ],
  },
  {
    name: 'Science',
    colour: 'text-science border-science/30 bg-science/5',
    badge: 'bg-science text-white',
    years: [
      { label: 'Year 1–2', stage: 'KS1', topics: 'Living things, materials, seasonal change' },
      { label: 'Year 3–6', stage: 'KS2', topics: 'Forces, light, plants, rocks, electricity' },
      { label: 'Year 7–9', stage: 'KS3', topics: 'Cells, atoms, energy, waves, evolution' },
      { label: 'Year 10–11', stage: 'KS4 (GCSE)', topics: 'Cell biology, genetics, chemical changes, electricity, space physics (AQA and Edexcel)' },
    ],
  },
  {
    name: 'History',
    colour: 'text-ink border-black/10 bg-black/[0.02]',
    badge: 'bg-ink text-white',
    years: [
      { label: 'Year 1–2', stage: 'KS1', topics: 'Changes within living memory, significant people and events, homes and toys of the past' },
      { label: 'Year 3–6', stage: 'KS2', topics: 'Ancient civilisations, the Romans, Anglo-Saxons and Vikings, and British history since 1066' },
      { label: 'Year 7–9', stage: 'KS3', topics: 'Medieval realms, the Tudors, empire and industry, and the twentieth-century world wars' },
    ],
  },
  {
    name: 'Geography',
    colour: 'text-ink border-black/10 bg-black/[0.02]',
    badge: 'bg-ink text-white',
    years: [
      { label: 'Year 1–2', stage: 'KS1', topics: 'Local geography, the countries of the UK, continents, oceans and seasonal weather' },
      { label: 'Year 3–6', stage: 'KS2', topics: 'Maps and compasses, rivers and mountains, climate zones, human and physical geography' },
      { label: 'Year 7–9', stage: 'KS3', topics: 'Population and urbanisation, ecosystems, tectonics, and global development' },
    ],
  },
]

export default function SubjectsPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-20 border-b border-black/5 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <DeciferLogo size="sm" product="Learning" />
          <div className="flex items-center gap-3">
            <DarkModeToggle />
            <Link href="/pricing" className="text-sm font-semibold text-maths hover:underline">Pricing</Link>
            <Link href="/register" className="h-9 rounded-lg bg-maths px-4 text-sm font-semibold text-white flex items-center">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-ink">What we cover</h1>
          <p className="mt-3 text-lg text-muted">
            The British curriculum, five subjects. Maths, English and Science from Year 1 to GCSE, with History and Geography to Year 9.
          </p>
          <Link
            href="/curriculum"
            className="mt-4 inline-block text-sm font-semibold text-maths hover:underline"
          >
            Browse every topic, year by year →
          </Link>
        </div>

        <div className="mt-12 space-y-8">
          {SUBJECTS.map((subject) => (
            <div key={subject.name} className={`rounded-2xl border p-6 ${subject.colour}`}>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${subject.badge}`}>
                  {subject.name}
                </span>
              </div>
              <div className="mt-4 divide-y divide-black/5">
                {subject.years.map((y) => (
                  <div key={y.label} className="flex gap-4 py-3">
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-semibold text-ink">{y.label}</p>
                      <p className="text-xs text-muted">{y.stage}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-ink">{y.topics}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-maths/5 border border-maths/20 p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-ink">Ready to start?</h2>
          <p className="mt-2 text-muted">Free for the first 3 Maths topics. No card required.</p>
          <Link
            href="/register"
            className="mt-6 inline-flex h-12 items-center rounded-xl bg-maths px-8 font-semibold text-white"
          >
            Create a free account
          </Link>
        </div>
      </main>
    </div>
  )
}
