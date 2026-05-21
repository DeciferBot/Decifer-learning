import Link from 'next/link'
import { getPublishedSubjects } from '@/lib/lesson-store'

export const metadata = { title: 'Learn — Decifer Learning' }

export default async function LearnIndexPage() {
  const subjects = await getPublishedSubjects()

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-ink">What would you like to learn?</h1>

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
          <p className="text-muted">More lessons are coming soon.</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/learn/${subject.slug}`}
                className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
                style={{ borderLeftWidth: 4, borderLeftColor: `var(--${subject.colour_token}, #6C9EFF)` }}
              >
                <span className="flex-1 font-heading font-bold text-ink">{subject.name}</span>
                <span className="text-sm text-muted">
                  {subject.lessonCount} {subject.lessonCount === 1 ? 'lesson' : 'lessons'}
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
