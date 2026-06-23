export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { resolvePlayer } from '@/lib/live/server'
import { LiveGameClient } from '@/components/live/LiveGameClient'

// Public Decifer Live game view — works for logged-in players AND guests who
// joined with just a nickname. Anyone who hasn't joined is sent to /join.
export default async function LiveGamePage({ params }: { params: { gameId: string } }) {
  const player = await resolvePlayer(params.gameId)
  if (!player) redirect(`/join`)

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <LiveGameClient gameId={params.gameId} myPlayerId={player.id} isHost={player.is_host} />
      </div>
    </main>
  )
}
