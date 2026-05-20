import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { QuizShell, type QuizQuestion } from '@/components/quiz/QuizShell'

// RLS: topics_select_published (is_published=true)
// RLS: quiz_questions_select_published (status='published') + FORCE RLS
// App-layer .eq('status', 'published') is defence-in-depth.

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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

  // Fetch up to 20 published questions; slice to 10 after shuffle.
  // FORCE RLS on quiz_questions ensures status='published' even if app filter were absent.
  const { data: rawQuestions } = await supabase
    .from('quiz_questions')
    .select('id, tier, question_text, correct_answer, distractors, hint_1, hint_2, hint_3, explanation')
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .limit(20)

  if (!rawQuestions || rawQuestions.length === 0) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted">No quiz questions are available for this topic yet.</p>
        <Link href="/dashboard/child" className="text-maths underline">
          Back to home
        </Link>
      </div>
    )
  }

  const questions: QuizQuestion[] = shuffle(rawQuestions as QuizQuestion[]).slice(0, 10)

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

      <QuizShell questions={questions} topicId={params.id} />
    </div>
  )
}
