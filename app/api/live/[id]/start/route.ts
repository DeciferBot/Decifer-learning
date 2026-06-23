import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthedProfile } from '@/lib/live/server'

// POST /api/live/[id]/start — host moves the lobby into the first question.
// Realtime propagates the live_games row change to every joined device.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const game = await prisma.liveGame.findUnique({
    where: { id: params.id },
    select: { host_profile_id: true, status: true },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (game.host_profile_id !== profile.id) {
    return NextResponse.json({ error: 'Only the host can start' }, { status: 403 })
  }
  if (game.status !== 'lobby') {
    return NextResponse.json({ error: 'Already started' }, { status: 409 })
  }

  await prisma.liveGame.update({
    where: { id: params.id },
    data: { status: 'in_progress', current_index: 0, current_started_at: new Date() },
  })

  return NextResponse.json({ ok: true })
}
