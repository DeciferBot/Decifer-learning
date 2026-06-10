export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { UpgradeWall } from '@/components/ui/UpgradeWall'
import { isTopicAccessible } from '@/lib/stripe'
import { FillBlank } from '@/components/games/FillBlank'
import { NumberLine } from '@/components/games/NumberLine'
import { EquationBalancer } from '@/components/games/EquationBalancer'
import { DragDrop } from '@/components/games/DragDrop'
import { SpeedRound } from '@/components/games/SpeedRound'
import { rotateFillBlankItems } from '@/lib/adaptive'
import { Layers } from '@/components/ui/icons'
import type { NumberLineConfig } from '@/components/games/NumberLine'
import type { EquationBalancerConfig } from '@/components/games/EquationBalancer'
import type { DragDropConfig } from '@/components/games/DragDrop'
import type { SpeedRoundConfig } from '@/components/games/SpeedRound'

// RLS: topics_select_published (is_published=true)
// RLS: practice_games_select_via_published_topic
// Practice rotation: rotateFillBlankItems shuffles config_json.questions per session (Phase 10D).

type TopicRow = { id: string; title: string }

type PracticeQuestion = { display: string; answer: string }
type PracticeConfig = {
  title: string
  instructions: string
  questions: PracticeQuestion[]
}

type GameRow = {
  id: string
  game_type: string
  config_json: unknown
}

export async function generateMetadata() {
  return { title: 'Practise — Decifer Learning' }
}

export default async function PractisePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, title')
    .eq('id', params.id)
    .eq('is_published', true)
    .maybeSingle<TopicRow>()

  // Subscription gate
  {
    const user = await getAuthUser()
    if (user && topic) {
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

  if (!topic) notFound()

  const subjectRow = await prisma.topic.findUnique({
    where: { id: params.id },
    select: { subject: { select: { name: true } } },
  })
  const subjectName = subjectRow?.subject?.name ?? null

  // Phase 11A: filter status='published' so only approved practice games reach children.
  const { data: game } = await supabase
    .from('practice_games')
    .select('id, game_type, config_json')
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .maybeSingle<GameRow>()

  if (!game) {
    return (
      <div className="space-y-5">
        <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
          <a href="/dashboard/child" className="hover:text-ink">Home</a>
          <span aria-hidden>/</span>
          {subjectName && <><span>{subjectName}</span><span aria-hidden>/</span></>}
          <span className="font-medium text-ink">{topic.title}</span>
        </nav>
        <div className="rounded-2xl border border-black/5 bg-surface p-8 text-center space-y-3">
          <div className="flex justify-center"><Layers className="w-8 h-8 text-muted" aria-hidden /></div>
          <h1 className="font-heading text-xl font-bold text-ink">{topic.title}</h1>
          <p className="text-sm text-muted">Practice activities for this topic are coming soon.</p>
          <a
            href={`/topics/${params.id}/quiz`}
            className="inline-flex min-h-[48px] items-center rounded-xl bg-maths px-6 py-3 font-heading font-bold text-white"
          >
            Skip to Quiz →
          </a>
        </div>
      </div>
    )
  }

  const header = (
    <>
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="breadcrumb">
        <Link href="/dashboard/child" className="hover:text-ink">Home</Link>
        <span aria-hidden>/</span>
        {subjectName && <><span>{subjectName}</span><span aria-hidden>/</span></>}
        <Link href={`/topics/${params.id}/learn`} className="hover:text-ink">{topic.title}</Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">Practise</span>
      </nav>

      <div className="flex gap-2">
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">1 Learn</span>
        <span className="rounded-full bg-maths px-3 py-1 text-xs font-bold text-white">2 Practise</span>
        <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-muted">3 Quiz</span>
      </div>

      <h1 className="font-heading text-2xl font-bold text-ink">{topic.title}</h1>
    </>
  )

  if (game.game_type === 'number_line') {
    return (
      <div className="space-y-5">
        {header}
        <NumberLine config={game.config_json as NumberLineConfig} topicId={params.id} />
      </div>
    )
  }

  if (game.game_type === 'equation_balancer') {
    return (
      <div className="space-y-5">
        {header}
        <EquationBalancer config={game.config_json as EquationBalancerConfig} topicId={params.id} />
      </div>
    )
  }

  if (game.game_type === 'drag_drop') {
    return (
      <div className="space-y-5">
        {header}
        <DragDrop config={game.config_json as DragDropConfig} topicId={params.id} />
      </div>
    )
  }

  if (game.game_type === 'speed_round') {
    return (
      <div className="space-y-5">
        {header}
        <SpeedRound config={game.config_json as SpeedRoundConfig} topicId={params.id} />
      </div>
    )
  }

  if (game.game_type !== 'fill_blank') notFound()

  const rawConfig = game.config_json as PracticeConfig
  // Rotate: shuffle and show up to 10 items per session for freshness.
  // Larger config_json.questions pools produce more variety across visits.
  const config: PracticeConfig = {
    ...rawConfig,
    questions: rotateFillBlankItems(rawConfig.questions ?? [], 10),
  }

  return (
    <div className="space-y-5">
      {header}
      <FillBlank config={config} topicId={params.id} />
    </div>
  )
}
