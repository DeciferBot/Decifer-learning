export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { LiveGameClient } from '@/components/live/LiveGameClient'

// The live game itself. Both host and players land here; the host gets the
// extra start/next controls. Anyone who isn't a member is sent back to /play.
export default async function LiveGamePage({ params }: { params: { gameId: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await prisma.profile.findUnique({
    where: { user_id: user.id },
    select: { id: true },
  })
  if (!profile) redirect('/play')

  const player = await prisma.liveGamePlayer.findUnique({
    where: { game_id_profile_id: { game_id: params.gameId, profile_id: profile.id } },
    select: { id: true },
  })
  if (!player) redirect('/play')

  return <LiveGameClient gameId={params.gameId} myProfileId={profile.id} />
}
