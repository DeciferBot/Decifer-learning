// Children's Code soft gate for self-registered child accounts.
//
// Policy: a child gets full access for a 7-day grace window after signup.
// If no parent/guardian has confirmed by then, quizzes pause (Learn pages
// stay open — mirrors the screen-time limit) until verification happens.
//
// A child counts as verified when EITHER:
//   • a linked parent exists in family_links (parent created/linked the
//     account, so parental involvement is proven), OR
//   • profiles.parent_email_verified_at is set (parent clicked the email link).
//
// Accounts created before this feature shipped are measured from the launch
// date rather than their signup date, so existing kids get the same 7 days.

import { prisma } from './prisma'

export const CONSENT_GATE_LAUNCH = new Date('2026-06-10T00:00:00Z')
export const CONSENT_GRACE_MS = 7 * 24 * 60 * 60 * 1000

export type ConsentGate =
  | { state: 'verified' }
  | { state: 'grace'; daysLeft: number; hasParentEmail: boolean }
  | { state: 'gated'; hasParentEmail: boolean }

export type ConsentProfileFields = {
  role: string
  parent_email: string | null
  parent_email_verified_at: Date | null
  created_at: Date
}

export async function getConsentGate(userId: string): Promise<ConsentGate> {
  const [profile, link] = await Promise.all([
    prisma.profile.findUnique({
      where: { user_id: userId },
      select: {
        role: true,
        parent_email: true,
        parent_email_verified_at: true,
        created_at: true,
      },
    }),
    prisma.familyLink.findUnique({
      where: { child_user_id: userId },
      select: { id: true },
    }),
  ])

  return evaluateConsentGate(profile, !!link)
}

// Pure evaluation over already-fetched rows — lets callers that have the
// profile in hand (e.g. the child layout's combined gate query) avoid a
// second database round-trip.
export function evaluateConsentGate(
  profile: ConsentProfileFields | null,
  hasFamilyLink: boolean,
): ConsentGate {
  if (!profile || profile.role !== 'child') return { state: 'verified' }
  if (profile.parent_email_verified_at || hasFamilyLink) return { state: 'verified' }

  const anchor = Math.max(profile.created_at.getTime(), CONSENT_GATE_LAUNCH.getTime())
  const msLeft = anchor + CONSENT_GRACE_MS - Date.now()
  const hasParentEmail = !!profile.parent_email

  if (msLeft > 0) {
    return {
      state: 'grace',
      daysLeft: Math.max(1, Math.ceil(msLeft / 86_400_000)),
      hasParentEmail,
    }
  }
  return { state: 'gated', hasParentEmail }
}

// Standard 422 payload for gated quiz endpoints — same shape family as the
// SCREEN_TIME_LIMIT response in /api/quiz/submit.
export const CONSENT_GATE_RESPONSE = {
  error: 'Quizzes are paused until a parent or guardian confirms this account',
  code: 'PARENT_CONSENT_REQUIRED',
} as const
