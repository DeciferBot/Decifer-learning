import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { QuizShell, type QuizQuestion } from '@/components/quiz/QuizShell'
import { FlagCheckered } from '@/components/ui/icons'

// Zone checkpoint: a 3-question mini-quiz surfaced after every 3rd topic completion in a zone.
// Uses the same QuizShell with a lightweight submit endpoint that does NOT award cards/badges
// (checkpoints are assessment gates, not reward moments).

export async function generateMetadata() {
  return { title: 'Zone Checkpoint' }
}

export default async function CheckpointPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile) redirect('/login')

  // Verify the topic exists and is published
  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, subject_id, zone_id')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle<{ id: string; title: string; subject_id: string; zone_id: string | null }>()

  if (!topic || !topic.zone_id) notFound()

  // Pull 3 published questions from the topic — sprout/explorer tiers preferred
  const { data: pool } = await supabase
    .from('quiz_questions')
    .select('id, tier, question_type, question_text, correct_answer, distractors, hint_1, hint_2, hint_3, explanation, worked_example, technique_type, technique_hint, technique_note, answer_parts, source_text, source_label, source_type')
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .in('tier', ['sprout', 'explorer'])
    .limit(10)

  if (!pool || pool.length === 0) notFound()

  // Shuffle and take 3
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const questions = shuffled.slice(0, 3) as QuizQuestion[]

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/world-map" className="hover:text-ink">World Map</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">Zone Checkpoint</span>
      </nav>

      <div className="rounded-2xl border-2 border-explorer/30 bg-explorer/5 p-4">
        <div className="flex items-center gap-2">
          <FlagCheckered className="w-7 h-7 text-explorer" aria-hidden />
          <div>
            <p className="font-heading font-bold text-ink">Zone Checkpoint</p>
            <p className="text-sm text-muted">
              3 quick questions to check you&apos;re on track. Pass to keep unlocking!
            </p>
          </div>
        </div>
      </div>

      <h1 className="font-heading text-2xl font-bold text-ink">{topic.title}: Checkpoint</h1>

      <QuizShell
        questions={questions}
        topicId={params.id}
        submitUrl="/api/quiz/checkpoint"
        backHref="/world-map"
        backLabel="Back to World Map"
        winMessage="Checkpoint passed! Keep going."
      />
    </div>
  )
}
