export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PlayHome, type HostSubject } from '@/components/live/PlayHome'

// Decifer Live entry: host a new game (pick a topic or a mixed-subject blast)
// or join one with a 6-digit PIN. Host options are scoped to the child's own
// year group; only subjects/topics with published, tap-tile questions appear.
export default async function PlayPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { year_group_id: true },
  })
  const yearGroupId = profile?.year_group_id ?? null

  let subjects: HostSubject[] = []
  if (yearGroupId) {
    const rows = await prisma.subject.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        colour_token: true,
        topics: {
          where: { year_group_id: yearGroupId, is_published: true },
          select: { id: true, title: true, order_index: true },
          orderBy: { order_index: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    subjects = rows
      .filter((s) => s.topics.length > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        colourToken: s.colour_token,
        topics: s.topics.map((t) => ({ id: t.id, title: t.title })),
      }))
  }

  return <PlayHome subjects={subjects} yearGroupId={yearGroupId} />
}
