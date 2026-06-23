export const dynamic = 'force-dynamic'

import { getAuthUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PlayHome, type HostSubject, type YearGroupOption } from '@/components/live/PlayHome'

// Decifer Blitz host entry — open to everyone, no account required.
// Logged-in users get their year group pre-selected; guests pick one.
export default async function PlayPage() {
  const user = await getAuthUser()

  // Load all year groups with their published, tap-tile subjects + topics.
  const yearGroups = await prisma.yearGroup.findMany({
    select: { id: true, label: true },
    orderBy: { label: 'asc' },
  })

  const yearGroupOptions: YearGroupOption[] = await Promise.all(
    yearGroups.map(async (yg) => {
      const rows = await prisma.subject.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          colour_token: true,
          topics: {
            where: { year_group_id: yg.id, is_published: true },
            select: { id: true, title: true, order_index: true },
            orderBy: { order_index: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      })
      const subjects: HostSubject[] = rows
        .filter((s) => s.topics.length > 0)
        .map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          colourToken: s.colour_token,
          topics: s.topics.map((t) => ({ id: t.id, title: t.title })),
        }))
      return { id: yg.id, label: yg.label, subjects }
    }),
  )

  // For logged-in users, pre-select their year group.
  let yearGroupId: string | null = null
  if (user) {
    const profile = await prisma.profile.findUnique({
      where: { user_id: user.id },
      select: { year_group_id: true },
    })
    yearGroupId = profile?.year_group_id ?? null
  }

  return (
    <PlayHome
      yearGroupOptions={yearGroupOptions}
      yearGroupId={yearGroupId}
      isLoggedIn={!!user}
    />
  )
}
