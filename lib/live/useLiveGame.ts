'use client'

import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Client view of a live game, kept in sync via Supabase Realtime (Postgres
// Changes). Subscribes to the game row and its player list; falls back to an
// initial fetch so first paint is immediate. Writes never happen here — they go
// through the server routes.

export type LiveGameState = {
  id: string
  pin: string
  status: 'lobby' | 'in_progress' | 'finished'
  mode: string
  question_count: number
  seconds_per_question: number
  current_index: number
  current_started_at: string | null
  host_profile_id: string
}

export type LivePlayer = {
  id: string
  profile_id: string
  display_name: string
  score: number
  is_host: boolean
}

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
    loadInitial()

    const channel = supabase
      .channel(`live:${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_games', filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length) setGame(payload.new as LiveGameState)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_game_players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          setPlayers((prev) => mergePlayer(prev, payload))
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return { game, players, ready }
}

type ChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

function mergePlayer(prev: LivePlayer[], payload: ChangePayload): LivePlayer[] {
  let next = prev
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: string }).id
    next = prev.filter((p) => p.id !== id)
  } else {
    const row = payload.new as unknown as LivePlayer
    const idx = prev.findIndex((p) => p.id === row.id)
    next = idx === -1 ? [...prev, row] : prev.map((p) => (p.id === row.id ? row : p))
  }
  return [...next].sort((a, b) => b.score - a.score)
}
