import { prisma } from '@/lib/prisma'

// Server-side Realtime Broadcast for Downtime board games — same mechanism
// and threat model as Decifer Live (see lib/live/broadcast.ts): pub/sub over
// WebSocket, routed through the nearest Realtime edge node, channel keyed by
// the (unguessable) game UUID. State stays server-authoritative; this only
// changes the delivery mechanism.
//
// Only the PUBLIC `state` column is ever broadcast or snapshotted here —
// never private_host_state / private_guest_state (Scrabble racks). A
// player's own rack is returned only from the authenticated move/state
// routes, directly in the HTTP response to that player.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLISH_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function boardGameChannel(gameId: string): string {
  return `board:${gameId}`
}

export type BoardGameSnapshot = {
  id: string
  game_type: string
  status: string
  state: unknown
  turn: string
  winner: string | null
  host_display_name: string
  guest_display_name: string | null
  updated_at: string
}

export async function boardGameSnapshot(gameId: string): Promise<BoardGameSnapshot | null> {
  const g = await prisma.boardGame.findUnique({
    where: { id: gameId },
    select: {
      id: true, game_type: true, status: true, state: true, turn: true, winner: true,
      host_display_name: true, guest_display_name: true, updated_at: true,
    },
  })
  if (!g) return null
  return { ...g, updated_at: g.updated_at.toISOString() }
}

export async function broadcastBoardGame(gameId: string, payload: BoardGameSnapshot): Promise<void> {
  if (!SUPABASE_URL || !PUBLISH_KEY) return
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: PUBLISH_KEY,
        Authorization: `Bearer ${PUBLISH_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ topic: boardGameChannel(gameId), event: 'sync', payload }],
      }),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    // best-effort — clients reconcile on (re)subscribe
  }
}

export async function broadcastBoardGameSnapshot(gameId: string): Promise<void> {
  const snap = await boardGameSnapshot(gameId)
  if (snap) await broadcastBoardGame(gameId, snap)
}
