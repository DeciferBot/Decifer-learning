import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { QuizShell, type QuizQuestion } from '@/components/quiz/QuizShell'
import { selectQuizQuestions } from '@/lib/adaptive'

// RLS: topics_select_published (is_published=true)
// RLS: quiz_questions_select_published (status='published') + FORCE RLS
// App-layer .eq('status', 'published') in selectQuizQuestions is defence-in-depth.
// Adaptive selection avoids recently-seen questions per child (Phase 10D).

export async function generateMetadata() {
  return { title: 'Quiz — Decifer Learning' }
}

export default async function QuizPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, title')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle<{ id: string; title: string }>()

  if (!topic) notFound()

  // Resolve profile first so adaptive selection can consult attempt history.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null

  // Adaptive selection: avoids questions seen in last 2 quizzes, balances tiers.
  // Falls back gracefully when pool is small. Only returns status='published' content.
  const selected = profile
    ? await selectQuizQuestions(supabase, profile.id, params.id)
    : await selectQuizQuestions(supabase, '', params.id) // unauthenticated: no history

  if (selected.length === 0) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted">No quiz questions are available for this topic yet.</p>
        <Link href="/dashboard/child" className="text-maths underline">
          Back to home
        </Link>
      </div>
    )
  }

  // Fetch streak shield count
  let initialShields = 0
  if (profile) {
    const shield = await prisma.streakShield.findUnique({
      where: { profile_id: profile.id },
    })
    initialShields = shield?.quantity ?? 0
  }

  const questions = selected as QuizQuestion[]

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/dashboard/child" className="hover:text-ink">Home</Link>
        <span aria-hidden>/</span>
        <Link href={`/topics/${params.id}/learn`} className="hover:text-ink">{topic.title}</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">Quiz</span>
      </nav>

      <div className="flex gap-2">
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">1 Learn</span>
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">2 Practise</span>
        <span className="rounded-full bg-maths px-3 py-1 text-xs font-bold text-white">3 Quiz</span>
      </div>

      <h1 className="font-heading text-2xl font-bold text-ink">{topic.title} — Quiz</h1>

      <QuizShell questions={questions} topicId={params.id} initialShields={initialShields} />
    </div>
  )
}
