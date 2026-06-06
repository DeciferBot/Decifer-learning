import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { isTopicAccessible } from '@/lib/stripe'

// GET /api/topics/[id]/questions
// Returns up to 20 published quiz questions for the given topic.
// Free-tier users only get questions for their allowed topics.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Subscription gate: check topic accessibility for free-tier users
  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { subscription_tier: true },
  })

  if (profile && profile.subscription_tier !== 'family') {
    // Look up the topic to get its subject slug and order_index
    const topic = await prisma.topic.findUnique({
      where: { id: params.id },
      select: {
        order_index: true,
        subject: { select: { slug: true } },
      },
    })
    if (topic) {
      const accessible = isTopicAccessible({
        tier: profile.subscription_tier,
        subjectSlug: topic.subject.slug,
        topicOrderIndex: topic.order_index,
      })
      if (!accessible) {
        return NextResponse.json({ error: 'upgrade_required' }, { status: 402 })
      }
    }
  }

  const { data, error } = await supabase
    .from('quiz_questions')
    .select(
      'id, tier, question_type, question_text, correct_answer, distractors, hint_1, hint_2, hint_3, explanation, technique_type, technique_hint, technique_note, answer_parts, source_text, source_label, source_type'
    )
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ questions: data ?? [] })
}
