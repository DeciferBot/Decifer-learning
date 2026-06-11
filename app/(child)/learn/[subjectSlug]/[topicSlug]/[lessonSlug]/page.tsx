export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { getChildYearGroupLabel } from '@/lib/child-gate'
import { getPublishedLesson } from '@/lib/lesson-store'
import { prisma } from '@/lib/prisma'
import { LessonEventTracker, LessonCompleteCTA } from '@/components/learn/LessonEventTracker'

type Props = {
  params: { subjectSlug: string; topicSlug: string; lessonSlug: string }
}

export async function generateMetadata({ params }: Props) {
  return { title: 'Lesson — Decifer Learning' }
}

// Safe copy for any state where a child-facing lesson cannot be shown.
// Never generate fallback content here.
function NotReadyPage({
  subjectSlug,
  topicSlug,
}: {
  subjectSlug: string
  topicSlug: string
}) {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/learn" className="hover:text-ink">Learn</Link>
        <span aria-hidden>/</span>
        <Link href={`/learn/${subjectSlug}`} className="hover:text-ink capitalize">{subjectSlug}</Link>
        <span aria-hidden>/</span>
        <Link href={`/learn/${subjectSlug}/${topicSlug}`} className="hover:text-ink capitalize">{topicSlug.replace(/-/g, ' ')}</Link>
      </nav>

      <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
        <p className="font-heading text-lg font-bold text-ink">This lesson is not ready yet.</p>
        <p className="mt-2 text-sm text-muted">More lessons are coming soon.</p>
        <Link
          href={`/learn/${subjectSlug}/${topicSlug}`}
          className="mt-6 inline-flex min-h-[48px] items-center rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          ← Back to topic
        </Link>
      </div>
    </div>
  )
}

export default async function LessonDetailPage({ params }: Props) {
  const { subjectSlug, topicSlug, lessonSlug } = params

  const user = await getAuthUser()
  if (!user) redirect('/login')
  const yearGroup = await getChildYearGroupLabel(user.id)
  if (!yearGroup) redirect('/dashboard')

  // Safety gate: only published+verified lessons in the child's own year group
  // are allowed through — a direct URL to another year's lesson shows NotReady.
  const lesson = await getPublishedLesson(lessonSlug, yearGroup)

  if (!lesson) {
    // Show safe not-ready state regardless of whether the slug exists.
    // Never reveal whether a lesson is staged/flagged/regenerating.
    return <NotReadyPage subjectSlug={subjectSlug} topicSlug={topicSlug} />
  }

  // Fetch the published learn content for this topic.
  // Explicit status filter is defence-in-depth (RLS also enforces this).
  const content = await prisma.learnContent.findFirst({
    where: { topic_id: lesson.topic_id, status: 'published' },
    select: { body_html: true },
  })

  // PLI v1: resolve subject_id for event tracking (needed by LessonEventTracker)
  const topicRow = await prisma.topic.findUnique({
    where: { id: lesson.topic_id },
    select: { subject_id: true },
  })

  return (
    <div className="space-y-6">
      {/* PLI v1: fire lesson_opened on mount, record active time on unmount */}
      <LessonEventTracker
        topicId={lesson.topic_id}
        lessonId={lesson.id}
        subjectId={topicRow?.subject_id ?? null}
      />

      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/learn" className="hover:text-ink">Learn</Link>
        <span aria-hidden>/</span>
        <Link href={`/learn/${subjectSlug}`} className="hover:text-ink capitalize">{subjectSlug}</Link>
        <span aria-hidden>/</span>
        <Link href={`/learn/${subjectSlug}/${topicSlug}`} className="hover:text-ink capitalize">{topicSlug.replace(/-/g, ' ')}</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{lesson.title}</span>
      </nav>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-muted">
            {lesson.key_stage} · {lesson.year_group}
          </span>
          {lesson.difficulty_lane && (
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-muted capitalize">
              {lesson.difficulty_lane}
            </span>
          )}
          {lesson.estimated_minutes && (
            <span className="text-sm text-muted">{lesson.estimated_minutes} min</span>
          )}
        </div>
        <h1 className="font-heading text-2xl font-bold text-ink">{lesson.title}</h1>
        {lesson.learning_objective && (
          <p className="text-sm text-muted">{lesson.learning_objective}</p>
        )}
      </div>

      {content ? (
        <div className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
          <div
            className="learn-content"
            dangerouslySetInnerHTML={{ __html: content.body_html }}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm">
          <p className="text-muted">This lesson is not ready yet.</p>
        </div>
      )}

      <div className="flex justify-end">
        {/* PLI v1: records lesson_completed before navigating to practice */}
        <LessonCompleteCTA
          href={`/topics/${lesson.topic_id}/practise`}
          topicId={lesson.topic_id}
          lessonId={lesson.id}
          subjectId={topicRow?.subject_id ?? null}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Start Practising →
        </LessonCompleteCTA>
      </div>
    </div>
  )
}
