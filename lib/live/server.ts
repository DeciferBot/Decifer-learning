import 'server-only'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// Cookie holding a guest player's per-browser token (a UUID). Lets a logged-out
// player be recognised across requests without an account — Kahoot style.
export const GUEST_COOKIE = 'dl_live_guest'
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 6 // 6 hours — long enough for a game

// The authenticated caller's profile, or null for a guest / logged-out visitor.
export async function getAuthedProfile() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.profile.findUnique({
    where: { user_id: user.id },
    select: {
      id: true,
      display_name: true,
      avatar_config: true,
      year_group_id: true,
      role: true,
    },
  })
}

export function getGuestToken(): string | null {
  return cookies().get(GUEST_COOKIE)?.value ?? null
}

export type ResolvedPlayer = {
  id: string
  is_host: boolean
  score: number
  streak: number
  profile_id: string | null
}

// Find the caller's player row in a game — whether they're a logged-in profile
// or a cookie-identified guest. Returns null if they haven't joined.
export async function resolvePlayer(gameId: string): Promise<ResolvedPlayer | null> {
  const profile = await getAuthedProfile()
  if (profile) {
    return prisma.liveGamePlayer.findUnique({
      where: { game_id_profile_id: { game_id: gameId, profile_id: profile.id } },
      select: { id: true, is_host: true, score: true, streak: true, profile_id: true },
    })
  }
  const token = getGuestToken()
  if (!token) return null
  return prisma.liveGamePlayer.findUnique({
    where: { game_id_guest_token: { game_id: gameId, guest_token: token } },
    select: { id: true, is_host: true, score: true, streak: true, profile_id: true },
  })
}

// A short, human-typable join code, unique among games that aren't finished.
export async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const pin = String(100000 + Math.floor(Math.random() * 900000))
    const clash = await prisma.liveGame.findFirst({
      where: { pin, status: { not: 'finished' } },
      select: { id: true },
    })
    if (!clash) return pin
  }
  throw new Error('Could not allocate a unique game PIN')
}

// Returns true if the caller is the host of gameId — works for both
// logged-in profile hosts and cookie-identified guest hosts.
export async function resolveHostAuth(gameId: string): Promise<boolean> {
  const game = await prisma.liveGame.findUnique({
    where: { id: gameId },
    select: { host_profile_id: true, host_guest_token: true },
  })
  if (!game) return false
  const profile = await getAuthedProfile()
  if (profile && game.host_profile_id === profile.id) return true
  const token = getGuestToken()
  if (token && game.host_guest_token === token) return true
  return false
}

// Trim + bound a guest nickname. Returns null if it can't be made valid.
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 20)
  if (name.length < 1) return null
  return name
}

// Basic email sanity check — not a full RFC validator, just enough to reject
// obviously bad input before it hits the DB.
export function isValidEmail(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  const s = raw.trim()
  return s.length >= 3 && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}
