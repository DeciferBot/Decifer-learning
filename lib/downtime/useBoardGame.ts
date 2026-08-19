'use client'

import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// Client view of a Downtime board game, kept in sync via Supabase Realtime
// Broadcast (see lib/downtime/broadcast.ts) — the same pub/sub-over-
// WebSocket mechanism as Decifer Live, but unlike Live this hook never
// queries the board_games table directly (no anon/authenticated SELECT
// policy exists on it at all — see the migration). Both the first-paint
// snapshot and every move go through app/api/downtime/games/*, which reads
// via Prisma server-side and hands back only the safe, redacted shape.
//
// Broadcast has no message replay, so a fresh GET is issued on first mount
// AND on every (re)subscribe — that covers first paint and self-heals any
// event missed during a brief disconnect.

export type BoardGameState = {
  id: string
  game_type: string
  status: 'waiting' | 'active' | 'finished'
  state: unknown
  turn: 'host' | 'guest'
  winner: 'host' | 'guest' | 'draw' | null
  host_display_name: string
  guest_display_name: string | null
  updated_at: string
}

export type BoardSide = 'host' | 'guest' | null

export function useBoardGame(gameId: string) {
  const [game, setGame] = useState<BoardGameState | null>(null)
  const [side, setSide] = useState<BoardSide>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  // The word-tile game's private rack — absent (stays null) for every other
  // game type. Populated from GET on first load and kept in sync from each
  // move response, so the mover sees their own new rack immediately without
  // waiting on a second round-trip (the Realtime broadcast never carries it —
  // it's private, see lib/downtime/broadcast.ts).
  const [rack, setRack] = useState<string[] | null>(null)
  const [ready, setReady] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch(`/api/downtime/games/${gameId}`)
      if (res.status === 404) {
        setNotFound(true)
        setReady(true)
        return
      }
      const data = await res.json()
      setSide(data.side ?? null)
      if (data.game) setGame(data.game)
      if (data.inviteCode) setInviteCode(data.inviteCode)
      if (Array.isArray(data.rack)) setRack(data.rack)
    } finally {
      setReady(true)
    }
  }, [gameId])

  useEffect(() => {
    let active = true
    loadInitial()

    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`board:${gameId}`)
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (!active) return
        setGame(payload as BoardGameState)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') loadInitial()
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [gameId, loadInitial])

  const sendMove = useCallback(async (move: unknown): Promise<boolean> => {
    setMoveError(null)
    try {
      const res = await fetch(`/api/downtime/games/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMoveError(data.error ?? 'move_failed')
        return false
      }
      setGame(data.game)
      if (Array.isArray(data.rack)) setRack(data.rack)
      return true
    } catch {
      setMoveError('network_error')
      return false
    }
  }, [gameId])

  return { game, side, inviteCode, rack, ready, notFound, moveError, sendMove }
}
