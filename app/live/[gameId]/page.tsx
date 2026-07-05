export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { resolvePlayer } from '@/lib/live/server'
import { prisma } from '@/lib/prisma'
import { LiveGameClient } from '@/components/live/LiveGameClient'

// Own Blitz OG card (app/live/[gameId]/opengraph-image.tsx) so a shared game
// link doesn't fall back to the home page preview.
export const metadata: Metadata = {
  title: 'Decifer Blitz | Live quiz battle',
  description:
    'A live, Kahoot-style quiz battle. Tap the link, pick a nickname, and play. No account needed.',
  openGraph: {
    title: 'Join my Decifer Blitz!',
    description:
      'A live, Kahoot-style quiz battle. Pick a nickname and play. No account needed.',
  },
  twitter: {
    title: 'Join my Decifer Blitz!',
    description:
      'A live, Kahoot-style quiz battle. Pick a nickname and play. No account needed.',
  },
}

// Public Decifer Live game view — works for logged-in players AND guests who
// joined with just a nickname. Anyone who hasn't joined is sent to /join.
export default async function LiveGamePage({ params }: { params: { gameId: string } }) {
  const player = await resolvePlayer(params.gameId)
  if (!player) redirect(`/join`)

  // Human label for what this game is about (e.g. "Maths · Number and Place
  // Value" or "Science · Mixed blast"), shown in the lobby so the scope is
  // always visible — no one can play the wrong subject without seeing it.
  const game = await prisma.liveGame.findUnique({
    where: { id: params.gameId },
    select: { mode: true, topic_id: true, subject_id: true },
  })
  let scopeLabel: string | null = null
  if (game) {
    // Topic-mode games store only topic_id (subject_id is null), so read the
    // subject via the topic. Subject-mode games store subject_id directly.
    const [topic, subject] = await Promise.all([
      game.topic_id
        ? prisma.topic.findUnique({
            where: { id: game.topic_id },
            select: { title: true, subject: { select: { name: true } } },
          })
        : null,
      game.subject_id
        ? prisma.subject.findUnique({ where: { id: game.subject_id }, select: { name: true } })
        : null,
    ])
    const subjectName = subject?.name ?? topic?.subject?.name
    if (game.mode === 'subject') {
      scopeLabel = subjectName ? `${subjectName} · Mixed blast` : 'Mixed blast'
    } else if (topic?.title) {
      scopeLabel = subjectName ? `${subjectName} · ${topic.title}` : topic.title
    } else if (subjectName) {
      scopeLabel = subjectName
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <LiveGameClient
          gameId={params.gameId}
          myPlayerId={player.id}
          isHost={player.is_host}
          scopeLabel={scopeLabel}
        />
      </div>
    </main>
  )
}
