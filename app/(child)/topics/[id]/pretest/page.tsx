import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { selectQuizQuestions } from '@/lib/adaptive'
import { PreTestShell } from '@/components/quiz/PreTestShell'
import type { QuizQuestion } from '@/components/quiz/QuizShell'

export async function generateMetadata() {
  return { title: 'Try It First — Decifer Learning' }
}

export default async function PreTestPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, subject_id, pedagogy_mode')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle<{ id: string; title: string; subject_id: string; pedagogy_mode: string }>()

  if (!topic) notFound()

  // Only pretest_first topics land here; others go straight to /learn
  if (topic.pedagogy_mode !== 'pretest_first') {
    redirect(`/topics/${params.id}/learn`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null
  const selected = profile
    ? await selectQuizQuestions(supabase, profile.id, params.id, { count: 1 })
    : await selectQuizQuestions(supabase, '', params.id, { count: 1 })

  // If no questions yet, skip straight to learn
  if (selected.length === 0) {
    redirect(`/topics/${params.id}/learn`)
  }

  const question = selected[0] as QuizQuestion

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/dashboard/child" className="hover:text-ink">Home</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{topic.title}</span>
      </nav>

      <div className="flex gap-2">
        <span className="rounded-full bg-explorer px-3 py-1 text-xs font-bold text-white">0 Try It</span>
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">1 Learn</span>
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">2 Quiz</span>
      </div>

      <h1 className="font-heading text-2xl font-bold text-ink">{topic.title}</h1>

      <PreTestShell
        question={question}
        topicId={topic.id}
        nextHref={`/topics/${params.id}/learn?from=pretest`}
        nextLabel="Read the lesson"
      />
    </div>
  )
}
