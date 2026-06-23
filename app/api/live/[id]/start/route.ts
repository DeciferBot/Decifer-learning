import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveHostAuth } from '@/lib/live/server'

// POST /api/live/[id]/start — host moves the lobby into the first question.
// Works for both logged-in profile hosts and cookie-identified guest hosts.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const isHost = await resolveHostAuth(params.id)
  if (!isHost) return NextResponse.json({ error: 'Only the host can start' }, { status: 403 })

  const game = await prisma.liveGame.findUnique({
    where: { id: params.id },
    select: { status: true },
  })
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (game.status !== 'lobby') return NextResponse.json({ error: 'Already started' }, { status: 409 })

  await prisma.liveGame.update({
    where: { id: params.id },
    data: { status: 'in_progress', current_index: 0, current_started_at: new Date() },
  })

  return NextResponse.json({ ok: true })
}
