export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { QuizShell, type QuizQuestion } from '@/components/quiz/QuizShell'
import { Gift } from '@/components/ui/icons'
import { selectQuizQuestions, selectInterleavedQuestions } from '@/lib/adaptive'
import { QuizEventTracker } from '@/components/quiz/QuizEventTracker'
import { UpgradeWall } from '@/components/ui/UpgradeWall'
import { isTopicAccessible } from '@/lib/stripe'

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
    .select('id, title, subject_id, zone_id')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle<{ id: string; title: string; subject_id: string; zone_id: string | null }>()

  if (!topic) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentProfile(supabase, user.id) : null

  // Subscription gate: free users can only access 3 Maths topics
  if (user) {
    const profileFull = await prisma.profile.findUnique({
      where: { user_id: user.id },
      select: { subscription_tier: true },
    })
    const subjectInfo = await prisma.topic.findUnique({
      where: { id: params.id },
      select: {
        order_index: true,
        subject: { select: { slug: true, name: true } },
      },
    })
    if (profileFull && subjectInfo && profileFull.subscription_tier !== 'family') {
      const accessible = isTopicAccessible({
        tier: profileFull.subscription_tier,
        subjectSlug: subjectInfo.subject.slug,
        topicOrderIndex: subjectInfo.order_index,
      })
      if (!accessible) {
        return <UpgradeWall topicTitle={topic.title} subjectName={subjectInfo.subject.name} />
      }
    }
  }

  // Within-session interleaving: if the child has 3+ completed topics in this
  // topic's zone, pull a mixed quiz across the 3 most recent completed topics.
  // Research basis: spacing g=0.43 in isolated practice (Murray et al. 2025).
  let selected: QuizQuestion[] = []

  if (profile && topic.zone_id) {
    // Find recently completed topics in the same zone (excluding current)
    const completedInZone = await prisma.topicProgress.findMany({
      where: {
        profile_id: profile.id,
        status: 'completed',
        topic: { zone_id: topic.zone_id, is_published: true },
      },
      orderBy: { completed_at: 'desc' },
      take: 3,
      select: { topic_id: true },
    })

    const otherCompletedIds = completedInZone
      .map((p) => p.topic_id)
      .filter((id) => id !== params.id)

    if (otherCompletedIds.length >= 2) {
      // Interleave: current topic + up to 2 recently completed others
      const topicIds = [params.id, ...otherCompletedIds.slice(0, 2)]
      const interleaved = await selectInterleavedQuestions(supabase, profile.id, topicIds)
      selected = interleaved as QuizQuestion[]
    }
  }

  // Fall back to single-topic adaptive selection
  if (selected.length === 0) {
    const fallback = profile
      ? await selectQuizQuestions(supabase, profile.id, params.id)
      : await selectQuizQuestions(supabase, '', params.id)
    selected = fallback as QuizQuestion[]
  }

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

  const questions = selected

  return (
    <div className="space-y-5">
      {/* PLI v1: fires quiz_started event; quiz_completed is recorded in /api/quiz/submit */}
      <QuizEventTracker topicId={topic.id} subjectId={topic.subject_id ?? null} />

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

      {/* Reward promise — shown before quiz starts */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: 'linear-gradient(90deg, #1a1a2e, #0f3460)', border: '1.5px solid rgba(255,193,7,0.35)' }}
      >
        <Gift className="w-6 h-6 flex-none" style={{ color: '#FFD43B' }} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-white font-heading">Score 70%+ → win a Discovery Card</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Guaranteed reward — every quiz pass earns a card
          </p>
        </div>
        <span className="flex-none text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(255,193,7,0.2)', color: '#FFD43B' }}>
          Reward
        </span>
      </div>

      <QuizShell questions={questions} topicId={params.id} topicTitle={topic.title} initialShields={initialShields} />
    </div>
  )
}
