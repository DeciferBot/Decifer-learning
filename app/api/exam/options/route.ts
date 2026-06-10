import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCurrentProfile } from '@/lib/profile'
import { canActAsParent } from '@/lib/auth/roles'
import { getLearntTopicIds } from '@/lib/exam'

// GET /api/exam/options?childId=...
// Returns the subjects a parent can set an exam in for this child:
// only subjects with published topics + published questions for the child's
// year group, with per-topic learnt status so exams cover what the child
// has already learnt.
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parentProfile = await getCurrentProfile(supabase, user.id)
  if (!parentProfile || !canActAsParent(parentProfile.role)) {
    return NextResponse.json({ error: 'Parent account required' }, { status: 403 })
  }

  const childId = new URL(request.url).searchParams.get('childId')
  if (!childId) return NextResponse.json({ error: 'childId required' }, { status: 400 })

  const childProfile = await prisma.profile.findUnique({
    where: { id: childId },
    select: { id: true, user_id: true, year_group_id: true, year_group: { select: { label: true } } },
  })
  if (!childProfile) return NextResponse.json({ error: 'Child not found' }, { status: 404 })

  const validLink = await prisma.familyLink.findFirst({
    where: {
      parent_user_id: parentProfile.user_id,
      child_user_id: childProfile.user_id,
    },
  })
  if (!validLink) return NextResponse.json({ error: 'Not your child' }, { status: 403 })

  if (!childProfile.year_group_id) {
    return NextResponse.json({
      yearGroupId: null,
      yearGroupLabel: null,
      subjects: [],
    })
  }

  // All published topics for the child's year group, with subject info
  const topics = await prisma.topic.findMany({
    where: { year_group_id: childProfile.year_group_id, is_published: true },
    select: {
      id: true,
      title: true,
      subject: { select: { id: true, name: true, colour_token: true } },
    },
    orderBy: { order_index: 'asc' },
  })

  // Published question counts per topic (children are only ever tested on
  // status='published' content)
  const questionCounts = await prisma.quizQuestion.groupBy({
    by: ['topic_id'],
    where: { topic_id: { in: topics.map((t) => t.id) }, status: 'published' },
    _count: { id: true },
  })
  const countByTopic = new Map(questionCounts.map((q) => [q.topic_id, q._count.id]))

  const learntIds = new Set(
    await getLearntTopicIds(childProfile.id, { yearGroupId: childProfile.year_group_id }),
  )

  // Group testable topics (≥1 published question) by subject
  type TopicOut = { id: string; title: string; questionCount: number; learnt: boolean }
  const bySubject = new Map<
    string,
    { id: string; name: string; colour_token: string; topics: TopicOut[] }
  >()
  for (const t of topics) {
    const questionCount = countByTopic.get(t.id) ?? 0
    if (questionCount === 0) continue
    let entry = bySubject.get(t.subject.id)
    if (!entry) {
      entry = { ...t.subject, topics: [] }
      bySubject.set(t.subject.id, entry)
    }
    entry.topics.push({ id: t.id, title: t.title, questionCount, learnt: learntIds.has(t.id) })
  }

  const subjects = [...bySubject.values()].map((s) => ({
    ...s,
    learntCount: s.topics.filter((t) => t.learnt).length,
  }))
  // Subjects with learnt content first, then alphabetical
  subjects.sort((a, b) => (b.learntCount > 0 ? 1 : 0) - (a.learntCount > 0 ? 1 : 0) || a.name.localeCompare(b.name))

  return NextResponse.json({
    yearGroupId: childProfile.year_group_id,
    yearGroupLabel: childProfile.year_group?.label ?? null,
    subjects,
  })
}
