export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { LessonEventTracker, LessonCompleteCTA } from '@/components/learn/LessonEventTracker'
import { LearnWidgetRenderer } from '@/components/learn/LearnWidgetRenderer'
import { LearnWidget } from '@/lib/learn-widgets'
import { UpgradeWall } from '@/components/ui/UpgradeWall'
import { isTopicAccessible } from '@/lib/stripe'
import { BookOpen } from '@/components/ui/icons'
import { ChapterStrip } from '@/components/curriculum/ChapterStrip'

// RLS policy "topics_select_published" (is_published=true) is enforced at DB level.
// RLS policy "learn_content_select_published" + FORCE RLS (status='published') is enforced at DB level.
// App-layer .eq() filters are defence-in-depth only.

type TopicRow = { id: string; title: string }
type ContentRow = { id: string; body_html: string; learn_widgets: unknown }
type PracticeRow = { id: string }

/** Split body_html into sections at <hr>, <!-- SECTION_BREAK -->, or <h2> boundaries. */
function splitHtml(html: string): string[] {
  const parts = html
    .split(/(?=<h2)|<hr\s*\/?>|<!-- SECTION_BREAK -->/gi)
    .filter(Boolean)
  return parts.length > 1 ? parts : [html]
}

/** Safely parse learn_widgets JSON from the DB. Returns [] on any failure. */
function parseWidgets(raw: unknown): LearnWidget[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as LearnWidget[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as LearnWidget[]) : []
    } catch {
      return []
    }
  }
  return []
}

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
    .select('id, title, subject_id, pedagogy_mode, quiz_optional')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle<TopicRow & { subject_id: string; pedagogy_mode: string; quiz_optional: boolean }>()

  if (!topic) notFound()

  // Subscription gate
  {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [profileRow, topicRow] = await Promise.all([
        prisma.profile.findUnique({ where: { user_id: user.id }, select: { subscription_tier: true } }),
        prisma.topic.findUnique({ where: { id: params.id }, select: { order_index: true, subject: { select: { slug: true, name: true } } } }),
      ])
      if (profileRow && topicRow && profileRow.subscription_tier !== 'family') {
        if (!isTopicAccessible({ tier: profileRow.subscription_tier, subjectSlug: topicRow.subject.slug, topicOrderIndex: topicRow.order_index })) {
          return <UpgradeWall topicTitle={topic.title} subjectName={topicRow.subject.name} />
        }
      }
    }
  }

  // Pretest-first topics: send child to attempt a question before reading the lesson.
  // ?from=pretest signals a return visit after the pretest — skip the redirect.
  if (topic.pedagogy_mode === 'pretest_first' && searchParams.from !== 'pretest') {
    redirect(`/topics/${params.id}/pretest`)
  }

  const { data: content } = await supabase
    .from('learn_content')
    .select('id, body_html, learn_widgets')
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .maybeSingle<ContentRow>()

  if (!content) {
    return (
      <div className="space-y-5">
        <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
          <a href="/dashboard/child" className="hover:text-ink">Home</a>
          <span aria-hidden>/</span>
          <span className="font-medium text-ink">{topic.title}</span>
        </nav>
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center space-y-3">
          <div className="flex justify-center"><BookOpen className="w-8 h-8 text-muted" aria-hidden /></div>
          <h1 className="font-heading text-xl font-bold text-ink">{topic.title}</h1>
          <p className="text-sm text-muted">This lesson is being prepared — check back soon.</p>
          <a
            href="/dashboard/child"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    )
  }

  // Skip the Practise step when no published practice_game exists for this topic.
  const { data: practice } = await supabase
    .from('practice_games')
    .select('id')
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .maybeSingle<PracticeRow>()
  const hasPractice = practice !== null
  const hasQuiz = !topic.quiz_optional

  const nextHref = hasPractice
    ? `/topics/${params.id}/practise`
    : hasQuiz
      ? `/topics/${params.id}/quiz`
      : '/dashboard/child'
  const nextLabel = hasPractice ? 'Start Practising →' : hasQuiz ? 'Start Quiz →' : 'Back to Home →'

  const sections = splitHtml(content.body_html)
  const widgets = parseWidgets(content.learn_widgets)

  const [units, subjectRow] = await Promise.all([
    prisma.curriculumUnit.findMany({
      where: { topic_id: params.id },
      select: { id: true, title: true, description: true, order_index: true, oak_confidence: true },
      orderBy: { order_index: 'asc' },
    }),
    prisma.topic.findUnique({
      where: { id: params.id },
      select: { subject: { select: { colour_token: true } } },
    }),
  ])
  const subjectColor = subjectRow?.subject?.colour_token ?? '#6C9EFF'

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
        {hasQuiz && (
          <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">
            {hasPractice ? '3 Quiz' : '2 Quiz'}
          </span>
        )}
      </div>

      <ChapterStrip units={units} subjectColor={subjectColor} />

      <h1 className="font-heading text-2xl font-bold text-ink">{topic.title}</h1>

      {/* Top widgets — before any content */}
      <LearnWidgetRenderer widgets={widgets} position="top" />

      {/* First section (intro) */}
      <div className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
        <div className="learn-content" dangerouslySetInnerHTML={{ __html: sections[0] }} />
      </div>

      {/* After-intro widgets — between section 0 and section 1 */}
      <LearnWidgetRenderer widgets={widgets} position="after_intro" />

      {/* Remaining sections */}
      {sections.slice(1).map((section, i) => (
        <div key={i} className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
          <div className="learn-content" dangerouslySetInnerHTML={{ __html: section }} />
        </div>
      ))}

      {/* Middle widgets — after the main body */}
      <LearnWidgetRenderer widgets={widgets} position="middle" />

      {/* End widgets — just before the CTA */}
      <LearnWidgetRenderer widgets={widgets} position="end" />

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
