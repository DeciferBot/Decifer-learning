import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LessonEventTracker, LessonCompleteCTA } from '@/components/learn/LessonEventTracker'

// RLS policy "topics_select_published" (is_published=true) is enforced at DB level.
// RLS policy "learn_content_select_published" + FORCE RLS (status='published') is enforced at DB level.
// App-layer .eq() filters are defence-in-depth only.

type TopicRow = { id: string; title: string }
type ContentRow = { id: string; body_html: string }
type PracticeRow = { id: string }

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: 'Learn — Decifer Learning' }
}

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { from?: string }
}) {
  const supabase = createSupabaseServerClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, subject_id, pedagogy_mode')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle<TopicRow & { subject_id: string; pedagogy_mode: string }>()

  if (!topic) notFound()

  // Pretest-first topics: send child to attempt a question before reading the lesson.
  // ?from=pretest signals a return visit after the pretest — skip the redirect.
  if (topic.pedagogy_mode === 'pretest_first' && searchParams.from !== 'pretest') {
    redirect(`/topics/${params.id}/pretest`)
  }

  const { data: content } = await supabase
    .from('learn_content')
    .select('id, body_html')
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .maybeSingle<ContentRow>()

  if (!content) notFound()

  // Skip the Practise step when no published practice_game exists for this topic.
  const { data: practice } = await supabase
    .from('practice_games')
    .select('id')
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .maybeSingle<PracticeRow>()
  const hasPractice = practice !== null

  const nextHref = hasPractice
    ? `/topics/${params.id}/practise`
    : `/topics/${params.id}/quiz`
  const nextLabel = hasPractice ? 'Start Practising →' : 'Start Quiz →'

  return (
    <div className="space-y-5">
      {/* PLI v1: fire lesson_opened on mount, record active time on unmount */}
      <LessonEventTracker
        topicId={topic.id}
        lessonId={topic.id}
        subjectId={topic.subject_id ?? null}
      />

      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/dashboard/child" className="hover:text-ink">Home</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{topic.title}</span>
      </nav>

      <div className="flex gap-2">
        <span className="rounded-full bg-maths px-3 py-1 text-xs font-bold text-white">1 Learn</span>
        {hasPractice && (
          <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">2 Practise</span>
        )}
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">
          {hasPractice ? '3 Quiz' : '2 Quiz'}
        </span>
      </div>

      <h1 className="font-heading text-2xl font-bold text-ink">{topic.title}</h1>

      <div className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <div
          className="learn-content"
          dangerouslySetInnerHTML={{ __html: content.body_html }}
        />
      </div>

      <div className="flex justify-end">
        {/* PLI v1: records lesson_completed before navigating */}
        <LessonCompleteCTA
          href={nextHref}
          topicId={topic.id}
          lessonId={topic.id}
          subjectId={topic.subject_id ?? null}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          {nextLabel}
        </LessonCompleteCTA>
      </div>
    </div>
  )
}
