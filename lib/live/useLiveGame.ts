'use client'

import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Client view of a live game, kept in sync via Supabase Realtime **Broadcast**
// (pub/sub over WebSocket), not Postgres Changes. The server publishes a `sync`
// event on the `live:<id>` channel whenever the game state or leaderboard
// changes (see lib/live/broadcast.ts). Broadcast fans out via the nearest
// Realtime node (big win for UAE latency) and skips Postgres Changes' per-
// subscriber RLS check, so it scales far better within the Pro plan.
//
// Broadcast has no message replay, so we re-fetch a fresh snapshot every time
// the channel (re)subscribes — that covers first paint AND self-heals any event
// missed during a brief disconnect. Writes never happen here.

export type LiveGameState = {
  id: string
  pin: string
  status: 'lobby' | 'in_progress' | 'finished'
  mode: string
  question_count: number
  seconds_per_question: number
  current_index: number
  current_started_at: string | null
  host_profile_id: string | null
}

export type LivePlayer = {
  id: string
  profile_id: string | null
  display_name: string
  score: number
  is_host: boolean
}

type SyncPayload = { game?: LiveGameState | null; players?: LivePlayer[] }

export function useLiveGame(gameId: string) {
  const [game, setGame] = useState<LiveGameState | null>(null)
  const [players, setPlayers] = useState<LivePlayer[]>([])
  const [ready, setReady] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabaseRef.current = supabase
    let active = true

    async function loadInitial() {
      const [{ data: g }, { data: ps }] = await Promise.all([
        supabase.from('live_games').select('*').eq('id', gameId).single(),
        supabase.from('live_game_players').select('*').eq('game_id', gameId).order('score', { ascending: false }),
      ])
      if (!active) return
      if (g) setGame(g as LiveGameState)
      if (ps) setPlayers(ps as LivePlayer[])
      setReady(true)
    }

    // First paint immediately, even if Realtime is slow/unavailable.
    loadInitial()

    const channel = supabase
      .channel(`live:${gameId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (!active) return
        const p = payload as SyncPayload
        if (p.game) setGame(p.game)
        if (p.players) setPlayers(p.players)
      })
      .subscribe((status) => {
        // Re-sync on first connect AND on every reconnect (broadcast has no
        // replay, so a snapshot fetch closes any gap).
        if (status === 'SUBSCRIBED') loadInitial()
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return { game, players, ready }
}
