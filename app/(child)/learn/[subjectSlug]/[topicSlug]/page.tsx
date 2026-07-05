import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/supabase/server'
import { getChildYearGroupLabel } from '@/lib/child-gate'
import { getPublishedLessonsForTopic } from '@/lib/lesson-store'

type Props = { params: { subjectSlug: string; topicSlug: string } }

export async function generateMetadata({ params }: Props) {
  return { title: `${params.topicSlug} · Learn` }
}

const LANE_LABEL: Record<string, string> = {
  sprout: 'Sprout',
  explorer: 'Explorer',
  lightning: 'Lightning',
}

export default async function TopicPage({ params }: Props) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const yearGroup = await getChildYearGroupLabel(user.id)
  if (!yearGroup) redirect('/dashboard')

  const { subject, topic, lessons } = await getPublishedLessonsForTopic(
    params.subjectSlug,
    params.topicSlug,
    yearGroup,
  )

  if (!subject) notFound()
  if (!topic) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
          <Link href="/learn" className="hover:text-ink">Learn</Link>
          <span aria-hidden>/</span>
          <Link href={`/learn/${subject.slug}`} className="hover:text-ink">{subject.name}</Link>
        </nav>
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
          <p className="text-muted">This topic is being prepared.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/learn" className="hover:text-ink">Learn</Link>
        <span aria-hidden>/</span>
        <Link href={`/learn/${subject.slug}`} className="hover:text-ink">{subject.name}</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{topic.title}</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold text-ink">{topic.title}</h1>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
          <p className="text-muted">More lessons are coming soon.</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/learn/${subject.slug}/${topic.slug}/${lesson.slug}`}
                className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-black/5 bg-surface px-5 py-4 shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
              >
                <div className="flex-1 space-y-1">
                  <p className="font-heading font-bold text-ink">{lesson.title}</p>
                  {lesson.learning_objective && (
                    <p className="text-sm text-muted">{lesson.learning_objective}</p>
                  )}
                </div>
                {lesson.difficulty_lane && (
                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-muted">
                    {LANE_LABEL[lesson.difficulty_lane] ?? lesson.difficulty_lane}
                  </span>
                )}
                {lesson.estimated_minutes && (
                  <span className="text-sm text-muted">{lesson.estimated_minutes} min</span>
                )}
                <span aria-hidden className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
