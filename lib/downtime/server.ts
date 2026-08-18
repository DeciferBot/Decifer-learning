import 'server-only'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getAuthedProfile } from '@/lib/live/server'

// Cookie holding a guest player's per-browser token (a UUID), same idea as
// Decifer Live's dl_live_guest but kept separate so the two features' guest
// identities never couple to each other.
export const GUEST_COOKIE = 'dl_downtime_guest'
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 // 24h — a board game can run much longer than a Blitz quiz

export { getAuthedProfile }
export { cleanNickname, NICKNAME_MAX_LENGTH } from '@/lib/live/nickname'

export function getGuestToken(): string | null {
  return cookies().get(GUEST_COOKIE)?.value ?? null
}

// Excludes 0/O/1/I — easy to misread or mistype when a kid is reading a code
// off a friend's screen.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    let code = ''
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    const clash = await prisma.boardGame.findFirst({
      where: { invite_code: code, status: { not: 'finished' } },
      select: { id: true },
    })
    if (!clash) return code
  }
  throw new Error('Could not allocate a unique invite code')
}

export type Side = 'host' | 'guest'

type GameIdentityColumns = {
  host_profile_id: string | null
  host_guest_token: string | null
  guest_profile_id: string | null
  guest_guest_token: string | null
}

// Resolves which side (if either) the current caller is in a game — whether
// they're a logged-in profile or a cookie-identified guest. Returns null if
// they aren't part of this game at all.
export async function resolveSide(game: GameIdentityColumns): Promise<Side | null> {
  const profile = await getAuthedProfile()
  if (profile) {
    if (game.host_profile_id === profile.id) return 'host'
    if (game.guest_profile_id === profile.id) return 'guest'
    return null
  }
  const token = getGuestToken()
  if (!token) return null
  if (game.host_guest_token === token) return 'host'
  if (game.guest_guest_token === token) return 'guest'
  return null
}
