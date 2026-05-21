import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublishedTopicsForSubject } from '@/lib/lesson-store'

type Props = { params: { subjectSlug: string } }

export async function generateMetadata({ params }: Props) {
  return { title: `${params.subjectSlug} — Learn — Decifer Learning` }
}

export default async function SubjectPage({ params }: Props) {
  const { subject, topics } = await getPublishedTopicsForSubject(params.subjectSlug)

  if (!subject) notFound()

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/learn" className="hover:text-ink">Learn</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{subject.name}</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold text-ink">{subject.name}</h1>

      {topics.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
          <p className="text-muted">This topic is being prepared.</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link
                href={`/learn/${subject.slug}/${topic.slug}`}
                className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
              >
                <span className="flex-1 font-heading font-bold text-ink">{topic.title}</span>
                <span className="text-sm text-muted">
                  {topic.lessonCount} {topic.lessonCount === 1 ? 'lesson' : 'lessons'}
                </span>
                <span aria-hidden className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
