export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getAuthUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PlayHome, type HostSubject, type YearGroupOption } from '@/components/live/PlayHome'

// Own OG card (see app/play/opengraph-image.tsx) so a shared host link previews
// as Decifer Blitz, not the home page.
export const metadata: Metadata = {
  title: 'Host a Decifer Blitz — Live quiz battle',
  description:
    'Start a live, Kahoot-style quiz battle in 30 seconds. UK curriculum questions, no accounts for players, works on any device.',
  openGraph: {
    title: 'Host a Decifer Blitz — Live quiz battle',
    description:
      'Start a live, Kahoot-style quiz battle in 30 seconds. No accounts for players, works on any device.',
    url: 'https://www.deciferlearning.com/play',
  },
  twitter: {
    title: 'Host a Decifer Blitz — Live quiz battle',
    description:
      'Start a live, Kahoot-style quiz battle in 30 seconds. No accounts for players, works on any device.',
  },
}

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

  // Sort numerically by the year number ("year-2" before "year-10"), since the
  // DB labels are slugs and a string sort would order 1,10,11,2,3…
  const yearNum = (label: string) => parseInt(label.replace(/\D/g, ''), 10) || 0
  yearGroupOptions.sort((a, b) => yearNum(a.label) - yearNum(b.label))

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
