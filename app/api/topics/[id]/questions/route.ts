import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET /api/topics/[id]/questions
// Returns up to 20 published quiz questions for the given topic.
// Auth: requires a valid session cookie — uses anon key so RLS applies.
// RLS: quiz_questions_select_published (status='published') + FORCE RLS
// App-layer .eq('status', 'published') is defence-in-depth.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('quiz_questions')
    .select(
      'id, tier, question_text, correct_answer, distractors, hint_1, hint_2, hint_3, explanation'
    )
    .eq('topic_id', params.id)
    .eq('status', 'published')
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ questions: data ?? [] })
}
