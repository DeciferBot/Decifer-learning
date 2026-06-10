export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { QuizShell, type QuizQuestion } from '@/components/quiz/QuizShell'
import { GuardianBattleHeader } from '@/components/quiz/GuardianBattleHeader'
import { getConsentGate } from '@/lib/parental-consent'
import { ConsentGateScreen } from '@/components/child/ConsentGateScreen'

const GUARDIAN_QUESTION_COUNT = 15

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function generateMetadata({ params }: { params: { zoneId: string } }) {
  const zone = await prisma.zone.findUnique({
    where: { id: params.zoneId },
    select: { name: true },
  })
  return {
    title: zone ? `${zone.name} Guardian — Decifer Learning` : 'Guardian — Decifer Learning',
  }
}

export default async function GuardianPage({ params }: { params: { zoneId: string } }) {
  const supabase = createSupabaseServerClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile(supabase, user.id)
  if (!profile?.year_group_id) redirect('/dashboard')

  // Parental-consent soft gate — the Guardian boss is a quiz surface too.
  const consentGate = await getConsentGate(user.id)
  if (consentGate.state === 'gated') {
    return <ConsentGateScreen />
  }

  // Zone must belong to this child's year group
  const zone = await prisma.zone.findUnique({
    where: { id: params.zoneId },
    select: { id: true, name: true, year_group_id: true },
  })
  if (!zone || zone.year_group_id !== profile.year_group_id) notFound()

  // Published topics in this zone
  const topics = await prisma.topic.findMany({
    where: { zone_id: zone.id, is_published: true },
    select: { id: true },
  })
  if (topics.length === 0) notFound()

  const topicIds = topics.map((t) => t.id)

  // All published questions for zone topics — shuffle and take 15
  const allQuestions = await prisma.quizQuestion.findMany({
    where: { topic_id: { in: topicIds }, status: 'published' },
    select: {
      id: true,
      tier: true,
      question_type: true,
      question_text: true,
      correct_answer: true,
      distractors: true,
      hint_1: true,
      hint_2: true,
      hint_3: true,
      explanation: true,
      worked_example: true,
      technique_type: true,
      technique_hint: true,
      technique_note: true,
      answer_parts: true,
      source_text: true,
      source_label: true,
      source_type: true,
      foundation_images: true,
    },
  })

  // Not enough published questions yet — send back to map
  if (allQuestions.length < GUARDIAN_QUESTION_COUNT) redirect('/world-map')

  const questions: QuizQuestion[] = shuffle(allQuestions)
    .slice(0, GUARDIAN_QUESTION_COUNT)
    .map((q) => ({
      id: q.id,
      tier: q.tier,
      question_type: q.question_type,
      question_text: q.question_text,
      correct_answer: q.correct_answer,
      distractors: (q.distractors as string[]) ?? [],
      hint_1: q.hint_1,
      hint_2: q.hint_2,
      hint_3: q.hint_3,
      explanation: q.explanation,
      worked_example: q.worked_example,
      technique_type: q.technique_type,
      technique_hint: q.technique_hint,
      technique_note: q.technique_note,
      answer_parts: q.answer_parts ?? null,
      source_text: q.source_text ?? null,
      source_label: q.source_label ?? null,
      source_type: q.source_type ?? null,
      foundation_images: (q.foundation_images as { url: string; alt?: string }[] | null) ?? null,
    }))

  return (
    <div className="space-y-4">
      <GuardianBattleHeader zoneName={zone.name} questionCount={GUARDIAN_QUESTION_COUNT} />
      <QuizShell
        questions={questions}
        topicId={null}
        submitUrl={`/api/guardian/${zone.id}/submit`}
        backHref="/world-map"
        backLabel="Back to Map"
        winMessage="Guardian defeated!"
        initialShields={0}
        isGuardian={true}
        zoneName={zone.name}
      />
    </div>
  )
}
