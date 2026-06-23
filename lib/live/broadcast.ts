import { prisma } from '@/lib/prisma'

// Server-side Realtime Broadcast for live games.
//
// We use Broadcast (pub/sub over WebSocket) rather than Postgres Changes for
// live fan-out. Broadcast routes through the nearest Realtime cluster node — so
// two players in the UAE exchange updates via an edge node instead of round-
// tripping to the Sydney database — and it skips the per-subscriber RLS check
// that makes Postgres Changes scale poorly. Scoring/state stay
// server-authoritative; this only changes the *delivery* mechanism.
//
// Vercel functions can't hold a WebSocket, so we publish via Realtime's REST
// broadcast endpoint. The channel is public and keyed by the (unguessable)
// game UUID — the same posture as the existing `USING (true)` SELECT policies
// on live_games / live_game_players, so no security regression. Answers are
// never broadcast (that table stays locked); a player only ever learns their
// own result, via the answer route's HTTP response.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Publish auth. The channel is public, so the anon key is sufficient to
// broadcast; we prefer the service key when present (future-proofs private
// channels) and fall back to anon so it works in every environment.
const PUBLISH_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Channel name shared with the client (useLiveGame).
export function liveChannel(gameId: string): string {
  return `live:${gameId}`
}

export type SnapshotGame = {
  id: string
  pin: string
  status: string
  mode: string
  question_count: number
  seconds_per_question: number
  current_index: number
  current_started_at: string | null
  host_profile_id: string | null
}

export type SnapshotPlayer = {
  id: string
  profile_id: string | null
  display_name: string
  score: number
  is_host: boolean
}

export type LiveSnapshot = { game: SnapshotGame | null; players: SnapshotPlayer[] }

// Read the current game + players in the exact shape the client consumes.
export async function liveGameSnapshot(gameId: string): Promise<LiveSnapshot> {
  const [g, players] = await Promise.all([
    prisma.liveGame.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        pin: true,
        status: true,
        mode: true,
        question_count: true,
        seconds_per_question: true,
        current_index: true,
        current_started_at: true,
        host_profile_id: true,
      },
    }),
    prisma.liveGamePlayer.findMany({
      where: { game_id: gameId },
      orderBy: { score: 'desc' },
      select: { id: true, profile_id: true, display_name: true, score: true, is_host: true },
    }),
  ])

  return {
    game: g
      ? {
          ...g,
          current_started_at: g.current_started_at ? g.current_started_at.toISOString() : null,
        }
      : null,
    players,
  }
}

// Publish a partial state update to every subscriber of the game's channel.
// Fire-and-forget by nature: if it fails, clients self-heal by re-fetching the
// snapshot whenever they (re)subscribe (broadcast has no message replay).
export async function broadcastLive(
  gameId: string,
  payload: Partial<LiveSnapshot>,
): Promise<void> {
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
        messages: [{ topic: liveChannel(gameId), event: 'sync', payload }],
      }),
      // Don't let a slow Realtime call hang the game route.
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    // best-effort — clients reconcile on (re)subscribe
  }
}

// Snapshot + broadcast in one call (the common case after a state change).
export async function broadcastLiveSnapshot(gameId: string): Promise<void> {
  const snap = await liveGameSnapshot(gameId)
  await broadcastLive(gameId, snap)
}
